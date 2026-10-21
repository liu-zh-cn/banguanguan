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

exports.main = async (event) => {
  const text = (event.text || '').trim();
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
