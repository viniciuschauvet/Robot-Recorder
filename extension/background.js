// Background script for Cypress Recorder
chrome.runtime.onInstalled.addListener(() => {
  console.log('Cypress Recorder Extension installed');
  chrome.storage.local.set({ isRecording: false, commands: [] });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
