function doPost(e) {
  try {
    const events = JSON.parse(e.postData.contents).events;

    events.forEach(myFunction);
  } catch (error) {
    console.log(error);
  }
}

function myFunction(event) {
  let message;
  const user = event.source.userId;

  if (event.type === "follow") {
    follow(user);
  }
}