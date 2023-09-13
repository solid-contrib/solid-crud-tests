// Import from "@inrupt/solid-client-authn-browser"
import {
  login,
  handleIncomingRedirect,
  getDefaultSession,
  fetch
} from "@inrupt/solid-client-authn-browser";

// Import from "@inrupt/solid-client"
import {
  addUrl,
  addStringNoLocale,
  createSolidDataset,
  createThing,
  getPodUrlAll,
  getSolidDataset,
  getThingAll,
  getStringNoLocale,
  removeThing,
  saveSolidDatasetAt,
  setThing
} from "@inrupt/solid-client";

import { SCHEMA_INRUPT, RDF, AS } from "@inrupt/vocab-common-rdf";

const selectorIdP = document.querySelector("#select-idp");
const selectorPod = document.querySelector("#select-pod");
const buttonLogin = document.querySelector("#btnLogin");
const buttonRead = document.querySelector("#btnRead");
const buttonCreate = document.querySelector("#btnCreate");
const buttonPatch = document.querySelector("#btnPatch");
const labelCreateStatus = document.querySelector("#labelCreateStatus");

buttonRead.setAttribute("disabled", "disabled");
buttonLogin.setAttribute("disabled", "disabled");
buttonCreate.setAttribute("disabled", "disabled");

// 1a. Start Login Process. Call login() function.
function loginToSelectedIdP() {
  const SELECTED_IDP = document.getElementById("select-idp").value;

  return login({
    oidcIssuer: SELECTED_IDP,
    redirectUrl: new URL("/", window.location.href).toString(),
    clientName: "Getting started app"
  });
}

// 1b. Login Redirect. Call handleIncomingRedirect() function.
// When redirected after login, finish the process by retrieving session information.
async function handleRedirectAfterLogin() {
  await handleIncomingRedirect(); // no-op if not part of login redirect

  const session = getDefaultSession();
  if (session.info.isLoggedIn) {
    // Update the page with the status.
    document.getElementById("myWebID").value = session.info.webId;

    // Enable Read button to read Pod URL
    buttonRead.removeAttribute("disabled");
  }
}

// The example has the login redirect back to the root page.
// The page calls this method, which, in turn, calls handleIncomingRedirect.
handleRedirectAfterLogin();

// 2. Get Pod(s) associated with the WebID
async function getMyPods() {
  const webID = document.getElementById("myWebID").value;
  const mypods = await getPodUrlAll(webID, { fetch: fetch });

  // Update the page with the retrieved values.

  mypods.forEach((mypod) => {
    let podOption = document.createElement("option");
    podOption.textContent = mypod;
    podOption.value = mypod;
    selectorPod.appendChild(podOption);
  });
}

// 3. Create the Reading List
async function createList() {
  labelCreateStatus.textContent = "";
  const SELECTED_POD = document.getElementById("select-pod").value;

  // For simplicity and brevity, this tutorial hardcodes the  SolidDataset URL.
  // In practice, you should add in your profile a link to this resource
  // such that applications can follow to find your list.
  const readingListUrl = `${SELECTED_POD}getting-started/readingList/myList`;

  let titles = document.getElementById("titles").value.split("\n");

  // Fetch or create a new reading list.
  let myReadingList;

  try {
    // Attempt to retrieve the reading list in case it already exists.
    myReadingList = await getSolidDataset(readingListUrl, { fetch: fetch });
    // Clear the list to override the whole list
    let items = getThingAll(myReadingList);
    items.forEach((item) => {
      myReadingList = removeThing(myReadingList, item);
    });
  } catch (error) {
    if (typeof error.statusCode === "number" && error.statusCode === 404) {
      // if not found, create a new SolidDataset (i.e., the reading list)
      myReadingList = createSolidDataset();
    } else {
      console.error(error.message);
    }
  }

  // Add titles to the Dataset
  let i = 0;
  titles.forEach((title) => {
    if (title.trim() !== "") {
      let item = createThing({ name: "title" + i });
      item = addUrl(item, RDF.type, AS.Article);
      item = addStringNoLocale(item, SCHEMA_INRUPT.name, title);
      myReadingList = setThing(myReadingList, item);
      i++;
    }
  });

  try {
    // Save the SolidDataset
    let savedReadingList = await saveSolidDatasetAt(
      readingListUrl,
      myReadingList,
      { fetch: fetch }
    );

    labelCreateStatus.textContent = "Saved";

    // Refetch the Reading List
    savedReadingList = await getSolidDataset(readingListUrl, { fetch: fetch });

    let items = getThingAll(savedReadingList);

    let listcontent = "";
    for (let i = 0; i < items.length; i++) {
      let item = getStringNoLocale(items[i], SCHEMA_INRUPT.name);
      if (item !== null) {
        listcontent += item + "\n";
      }
    }

    document.getElementById("savedtitles").value = listcontent;
  } catch (error) {
    console.log(error);
    labelCreateStatus.textContent = "Error" + error;
    labelCreateStatus.setAttribute("role", "alert");
  }
}

async function sendPatch() {
  const SELECTED_POD = document.getElementById("select-pod").value;
  const docUrl = `${SELECTED_POD}getting-started/test.ttl`;
  await fetch(docUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "text/n3",
    },
    body:
      "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
      "<#patch> a solid:InsertDeletePatch;\n" +
      "  solid:inserts { <#hello> <#linked> <#world> .}.\n",
  });
}

buttonLogin.onclick = function () {
  loginToSelectedIdP();
};

buttonRead.onclick = function () {
  getMyPods();
};

buttonCreate.onclick = function () {
  createList();
};

buttonPatch.onclick = function () {
  sendPatch();
};

selectorIdP.addEventListener("change", idpSelectionHandler);
function idpSelectionHandler() {
  if (selectorIdP.value === "") {
    buttonLogin.setAttribute("disabled", "disabled");
  } else {
    buttonLogin.removeAttribute("disabled");
  }
}

selectorPod.addEventListener("change", podSelectionHandler);
function podSelectionHandler() {
  if (selectorPod.value === "") {
    buttonCreate.setAttribute("disabled", "disabled");
  } else {
    buttonCreate.removeAttribute("disabled");
  }
}
