/**
 * Eye Relief — Offscreen Audio Player
 *
 * Plays the custom break-start and break-end notification chimes
 * reliably in Manifest V3 without webpage autoplay restrictions.
 */

const SOUND_FILES = {
  'break-start': 'sounds/notification.mp3',
  'break-end': 'sounds/break-end.mp3'
};

const audioCache = new Map();

function stopAllAudio() {
  for (const audio of audioCache.values()) {
    audio.pause();
    audio.currentTime = 0;
  }
}

async function playNotificationSound(soundKey = 'break-start') {
  const relativePath = SOUND_FILES[soundKey] || SOUND_FILES['break-start'];
  let audio = audioCache.get(relativePath);

  if (!audio) {
    audio = new Audio(chrome.runtime.getURL(relativePath));
    audio.preload = 'auto';
    audioCache.set(relativePath, audio);
  }

  stopAllAudio();
  audio.currentTime = 0;
  audio.volume = 0.85;
  await audio.play();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'PLAY_NOTIFICATION_SOUND') {
    return false;
  }

  (async () => {
    try {
      await playNotificationSound(message.sound);
      sendResponse({ ok: true });
    } catch (err) {
      console.error('Eye Relief offscreen: failed to play sound', err);
      sendResponse({ ok: false, error: err?.message || 'Audio playback failed' });
    }
  })();
  return true;
});
