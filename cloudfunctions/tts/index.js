// 云函数：tts —— 把文本转成语音，上传到云存储，返回可播放的 fileID
// 使用免费的百度翻译发音接口（支持中文句子），云函数内请求不受小程序域名白名单限制
// 备注：旧版用的有道 dictvoice 接口对中文文本返回 HTTP 500（仅英文可用），已弃用
const cloud = require('wx-server-sdk');
const https = require('https');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 抓取音频（跟随最多 3 次重定向），并记录状态码与内容摘要，便于定位失败原因
function fetchAudio(url, depth, info) {
  depth = depth || 0;
  info = info || {};
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Referer: 'https://fanyi.baidu.com/',
            Accept: '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9'
          }
        },
        (res) => {
          info.status = res.statusCode;
          if (
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location &&
            depth < 3
          ) {
            return resolve(fetchAudio(res.headers.location, depth + 1, info));
          }
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const buf = Buffer.concat(chunks);
            info.preview = buf.slice(0, 80).toString('utf8').replace(/\s+/g, ' ');
            resolve(buf);
          });
        }
      )
      .on('error', reject);
  });
}

const MAX_TEXT_LEN = 200; // 大屏广播一句话通常不到 50 字，200 字足够，防止被刷成超长合成

// 限流：同一 openid 每分钟最多 6 次合成。大屏 5 秒轮询一次但只在有新广播时才合成，
// 正常使用远低于此限；本函数无登录态可校验（大屏设备可能未注册），
// 至少挡住脚本刷量，保护百度接口配额与云存储不被刷爆
const RATE_LIMIT = 6;
const RATE_WINDOW = 60 * 1000;
const CACHE_KEEP_DAYS = 30; // 定时清理 30 天前的音频与缓存记录

function hashOf(text) {
  return crypto.createHash('md5').update(text).digest('hex');
}

// 跨实例限流：计数落在 rate_limits 集合，_id 固定为 openid + 分钟桶。
// 之前用进程内 Map，云函数扩容到多实例后每个实例各算一份，等于没限。
// 检查与自增不是原子操作，极端并发下可能多放过一两次，作为软限流足够。
async function rateLimited(openid) {
  const bucket = Math.floor(Date.now() / RATE_WINDOW);
  const id = 'tts_' + openid + '_' + bucket;
  const coll = db.collection('rate_limits');
  try {
    const cur = await coll.doc(id).get().catch(() => null);
    if (cur && cur.data) {
      if ((cur.data.count || 0) >= RATE_LIMIT) return true;
      await coll.doc(id).update({ data: { count: _.inc(1), ts: Date.now() } });
      return false;
    }
    await coll.add({ data: { _id: id, openid, count: 1, ts: Date.now() } });
    return false;
  } catch (e) {
    // 并发首次写入撞 _id：别的实例已经建桶，回落到计数
    try {
      await coll.doc(id).update({ data: { count: _.inc(1), ts: Date.now() } });
    } catch (e2) {
      // 限流表异常时放行，不能因为限流组件坏了就播不了广播
    }
    return false;
  }
}

// 文本级缓存：同一段广播只合成、上传一次，重复播报不再调百度接口
async function readCache(hash) {
  try {
    const r = await db.collection('tts_cache').doc(hash).get();
    return (r && r.data && r.data.fileID) || '';
  } catch (e) {
    return '';
  }
}

// 定时触发器调用（每天 04:00）：删除 30 天前的音频与缓存记录，
// 同时清掉一天前的限流计数。云存储没有「列目录」接口，只能靠 tts_cache 反查 fileID。
async function cleanup() {
  const cutoff = Date.now() - CACHE_KEEP_DAYS * 24 * 3600 * 1000;
  let removed = 0;
  try {
    // 每轮 100 条，最多 20 轮，避免一次定时任务跑太久
    for (let round = 0; round < 20; round++) {
      const res = await db
        .collection('tts_cache')
        .where({ ts: _.lt(cutoff) })
        .limit(100)
        .get();
      const rows = res.data || [];
      if (!rows.length) break;
      const fileList = rows.map((x) => x.fileID).filter(Boolean);
      if (fileList.length) await cloud.deleteFile({ fileList }).catch(() => null);
      for (const x of rows) {
        await db.collection('tts_cache').doc(x._id).remove().catch(() => null);
      }
      removed += rows.length;
      if (rows.length < 100) break;
    }

    const rateCutoff = Date.now() - 24 * 3600 * 1000;
    for (let round = 0; round < 20; round++) {
      const res = await db
        .collection('rate_limits')
        .where({ ts: _.lt(rateCutoff) })
        .limit(100)
        .get();
      const rows = res.data || [];
      if (!rows.length) break;
      for (const x of rows) {
        await db.collection('rate_limits').doc(x._id).remove().catch(() => null);
      }
      if (rows.length < 100) break;
    }
    return { ok: true, removed };
  } catch (e) {
    return { ok: false, msg: '清理失败：' + e.message };
  }
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  // 定时触发器没有 openid，小程序端调用一定带 OPENID：
  // 清理逻辑只能由定时器 / 云开发控制台触发，前端无权调用
  if (!OPENID) return cleanup();

  if (await rateLimited(OPENID)) {
    return { ok: false, code: 'RATE_LIMITED', msg: '合成太频繁，请稍后再试' };
  }
  // String() 兜底：text 被传成对象时 trim 会直接抛未捕获异常
  const text = String(event.text || '').trim();
  if (!text) return { ok: false, msg: '空文本' };
  if (text.length > MAX_TEXT_LEN) {
    return { ok: false, msg: '文本过长（最多 ' + MAX_TEXT_LEN + ' 字）' };
  }

  // 同一段文本直接复用已合成的音频，不再调百度、不再占一份新存储
  const hash = hashOf(text);
  const cached = await readCache(hash);
  if (cached) return { ok: true, fileID: cached, cached: true };

  try {
    const url =
      'https://fanyi.baidu.com/gettts?lan=zh&spd=5&source=web&text=' +
      encodeURIComponent(text);
    const info = {};
    const buf = await fetchAudio(url, 0, info);
    // 简单校验：不小于 1KB，且以 MP3 帧头（0xFF）或 ID3 标签开头
    const isMp3 =
      buf &&
      buf.length > 1000 &&
      (buf[0] === 0xff || buf.slice(0, 3).toString('latin1') === 'ID3');
    if (!isMp3) {
      return {
        ok: false,
        msg:
          '语音合成失败（HTTP ' +
          info.status +
          '，返回内容：' +
          (info.preview || '空') +
          '）'
      };
    }

    const upload = await cloud.uploadFile({
      cloudPath: 'tts/' + hash + '.mp3',
      fileContent: buf
    });
    // 同一段文本并发合成时两次上传会写到同一路径，内容一致；
    // 缓存文档撞 _id 直接忽略即可
    await db
      .collection('tts_cache')
      .add({ data: { _id: hash, fileID: upload.fileID, ts: Date.now() } })
      .catch(() => null);
    return { ok: true, fileID: upload.fileID };
  } catch (e) {
    return { ok: false, msg: 'TTS异常：' + e.message };
  }
};
