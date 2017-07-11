// Only show page_action if the page contains a password field
chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      actions: [
        new chrome.declarativeContent.ShowPageAction()
      ],
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          css: [
            'input[type="password"]'
          ]
        })
      ]
    }]);
  });
});
