const { Session } = require("@inrupt/solid-client-authn-node");

const SECRET = {
  app_name: 'solid-test-suite',
  clientId: 'b8a43a03-c9c0-4d93-8e65-8b3453e5c59f',
  clientSecret: 'c189fe84-0766-4a35-b21d-e03c2a9daa62',
  oidcIssuer: 'https://login.inrupt.com'
};

const session = new Session();
session.login(SECRET).then(() => {
  if (session.info.isLoggedIn) {
    // 3. Your session should now be logged in, and able to make authenticated requests.
    session
      // You can change the fetched URL to a private resource, such as your Pod root.
      .fetch(session.info.webId)
      .then((response) => {
        return response.text();
      })
      .then(console.log);
  }
});
