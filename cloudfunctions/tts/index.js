// 云函数：tts —— 把文本转成语音，上传到云存储，返回可播放的 fileID
// 使用免费的有道 dictvoice 接口，云函数内请求不受小程序域名白名单限制
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

// 抓取音频（跟随最多 3 次重定向）
function fetchAudio(url, depth) {
  depth = depth || 0;
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          depth < 3
        ) {
          return resolve(fetchAudio(res.headers.location, depth + 1));
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

exports.main = async (event) => {
  const text = (event.text || '').trim();
  if (!text) return { ok: false, msg: '空文本' };

  try {
    const url =
      'https://dict.youdao.com/dictvoice?audio=' +
      encodeURIComponent(text) +
      '&type=1';
    const buf = await fetchAudio(url);
    if (!buf || buf.length < 200) return { ok: false, msg: '语音合成失败' };

    const upload = await cloud.uploadFile({
      cloudPath: 'tts/' + Date.now() + '_' + Math.floor(Math.random() * 1000) + '.mp3',
      fileContent: buf
    });
    return { ok: true, fileID: upload.fileID };
  } catch (e) {
    return { ok: false, msg: 'TTS异常：' + e.message };
  }
};
