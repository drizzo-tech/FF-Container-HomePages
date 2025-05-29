const newTab = {
  async isNewTab(tab) {
    // checking openerTabId this way prevents loading default url to links that are directed to new tabs
    // such as "Open in New Tab". Otherwise, checking only the tab title and url is not enough as both
    // will keep updating while the tab status changes from "loading" to "complete".
    // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/onCreated
    // We could wait for the tab to finish loading and check the title and the url but that's time wasted.
    // There yet to exist a legitimate case where checking openerTabId does not work.
    // known issue: this won't work in case of opening "about:newtab" link as "Open in New Tab"
    // but arguably that's not a real use case.

    // this used to only check the openerTabId and worked for most cases, but caused a conflict with the MAC ext. issue #1
    // so checking the URL and title were added, which requires the tab permission.
    // Checking the URL alone should be enough but keeping the openerTabId check should not cause issues.
    //
    // Added check for pop-up to not redirect back to homepage

    // check if this tab is in a popup window
    if (tab.windowId) {
      try {
        const window = await browser.windows.get(tab.windowId);

        if (window.type === "popup") {
          console.log("Detected popup - not redirecting");
          return false;
        }
      } catch (e) {
        console.log("Error checking window type: ", e);
      }
    }
    let isNew =
      tab.openerTabId === undefined &&
      (tab.url === "about:newtab" || tab.url === "about:blank") &&
      tab.title === "New Tab";

    return isNew;
  },
  async onCreated(tab) {
    if (await newTab.isNewTab(tab)) {
      // Wait to see if the URL changes (indicating it's not a real new tab)
      setTimeout(async () => {
        try {
          const updatedTab = await browser.tabs.get(tab.id);

          // If URL is still about:newtab or about:blank, it's likely a real new tab
          if (
            updatedTab.url === "about:newtab" ||
            updatedTab.url === "about:blank"
          ) {
            const defaultUrl = await containerDefaultPages.getDefaultPage(
              updatedTab.cookieStoreId,
            );
            if (defaultUrl) {
              browser.tabs.update(updatedTab.id, { url: defaultUrl });
            }
          }
        } catch (e) {
          console.log("Error in delayed check:", e);
        }
      }, 100); // timeout to give pop-ups time to load url
    }
  },
  init() {
    browser.tabs.onCreated.addListener(this.onCreated);
  },
};

newTab.init();
