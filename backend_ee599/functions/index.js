const functions = require("firebase-functions");

const app = require("express")();

const FBAuth = require("./util/FBAuth");

const { db } = require("./util/admin");

const {
  getAllMoments,
  postOneMoment,
  getMoment,
  commentOnMoment,
  likeMoment,
  unlikeMoment,
  deleteMoment,
} = require("./handlers/moments");
const {
  signup,
  login,
  uploadImage,
  addUserDetails,
  getAuthenticateUser,
  getUserDetails,
  markNotificationsRead,
} = require("./handlers/users");

//Moment routes
app.get("/moments", getAllMoments);
app.post("/moment", FBAuth, postOneMoment);
app.get("/moment/:momentId", getMoment);
app.post("/moment/:momentId/comment", FBAuth, commentOnMoment);
app.get("/moment/:momentId/like", FBAuth, likeMoment);
app.get("/moment/:momentId/unlike", FBAuth, unlikeMoment);
app.delete("/moment/:momentId", FBAuth, deleteMoment);

//User routes
app.post("/signup", signup);
app.post("/login", login);
app.post("/user/image", FBAuth, uploadImage);
app.post("/user", FBAuth, addUserDetails);
app.get("/user", FBAuth, getAuthenticateUser);
app.get("/user/:handle", getUserDetails);
app.post("/notifications", FBAuth, markNotificationsRead);

exports.api = functions.https.onRequest(app);

exports.createNotificationOnLike = functions.firestore
  .document("likes/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/moment/${snapshot.data().momentId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "like",
            read: false,
            momentId: doc.id,
          });
        }
      })
      .catch((err) => console.error(err));
  });

exports.deleteNotificationOnUnLike = functions.firestore
  .document("likes/{id}")
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.createNotificationOnComment = functions.firestore
  .document("comments/{id}")
  .onCreate((snapshot) => {
    return db
      .doc(`/moment/${snapshot.data().momentId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: "comment",
            read: false,
            momentId: doc.id,
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onUserImageChange = functions.firestore
  .document("/users/{userId}")
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageURL !== change.after.data().imageURL) {
      console.log("image has changed");
      const batch = db.batch();
      return db
        .collection("moment")
        .where("userHandle", "==", change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const moment = db.doc(`/moment/${doc.id}`);
            batch.update(moment, { userImage: change.after.data().imageURL });
          });
          return db
            .collection("comments")
            .where("userHandle", "==", change.before.data().handle)
            .get();
        })
        .then((data) => {
          data.forEach((doc) => {
            const comment = db.doc(`/comments/${doc.id}`);
            batch.update(comment, { userImage: change.after.data().imageURL });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onMomentDelete = functions.firestore
  .document("/moment/{momentId}")
  .onDelete((snapshot, context) => {
    const momentId = context.params.momentId;
    const batch = db.batch();
    return db
      .collection("comments")
      .where("momentId", "==", momentId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db.collection("likes").where("momentId", "==", momentId).get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection("notifications")
          .where("momentId", "==", momentId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });
