// 云函数：tts —— 把文本转成语音，上传到云存储，返回可播放的 fileID
// 使用免费的百度翻译发音接口（支持中文句子），云函数内请求不受小程序域名白名单限制
// 备注：旧版用的有道 dictvoice 接口对中文文本返回 HTTP 500（仅英文可用），已弃用
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

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

// 简易内存限流（云函数实例复用期间有效）：同一 openid 每分钟最多 6 次合成。
// 大屏 5 秒轮询一次但只在有新广播时才合成，正常使用远低于此限；
// 本函数无登录态可校验（大屏设备可能未注册），至少挡住单实例内的脚本刷量，
// 保护百度接口配额与云存储不被刷爆
const RATE_LIMIT = 6;
const RATE_WINDOW = 60 * 1000;
const rateMap = new Map();

function rateLimited(openid) {
  const now = Date.now();
  const arr = (rateMap.get(openid) || []).filter((t) => now - t < RATE_WINDOW);
  if (arr.length >= RATE_LIMIT) {
    rateMap.set(openid, arr);
    return true;
  }
  arr.push(now);
  rateMap.set(openid, arr);
  return false;
}

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (rateLimited(OPENID || 'anonymous')) {
    return { ok: false, msg: '合成太频繁，请稍后再试' };
  }
  // String() 兜底：text 被传成对象时 trim 会直接抛未捕获异常
  const text = String(event.text || '').trim();
  if (!text) return { ok: false, msg: '空文本' };
  if (text.length > MAX_TEXT_LEN) {
    return { ok: false, msg: '文本过长（最多 ' + MAX_TEXT_LEN + ' 字）' };
  }

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
      cloudPath: 'tts/' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.mp3',
      fileContent: buf
    });
    return { ok: true, fileID: upload.fileID };
  } catch (e) {
    return { ok: false, msg: 'TTS异常：' + e.message };
  }
};
