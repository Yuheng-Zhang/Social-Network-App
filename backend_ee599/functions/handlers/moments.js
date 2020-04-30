const { db } = require("../util/admin");

exports.getAllMoments = (req, res) => {
  db.collection("moment")
    .orderBy("createTime", "desc")
    .get()
    .then((data) => {
      let moment = [];
      data.forEach((doc) => {
        moment.push({
          momentId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createTime: doc.data().createTime,
          commentCount: doc.data().commentCount,
          likeCount: doc.data().likeCount,
          userImage: doc.data().userImage
        });
      });
      return res.json(moment);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.postOneMoment = (req, res) => {
  if (req.body.body.trim() === "") {
    return res.status(400).json({ body: "Body must not be empty" });
  }
  const newMoment = {
    body: req.body.body,
    userHandle: req.user.handle,
    userImage: req.user.imageURL,
    createTime: new Date().toISOString(),
    likeCount: 0,
    commentCount: 0,
  };

  db.collection("moment")
    .add(newMoment)
    .then((doc) => {
      const resMoment = newMoment;
      resMoment.momentId = doc.id;
      res.json(resMoment);
    })
    .catch((err) => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
};

// fetch one moment
exports.getMoment = (req, res) => {
  let momentData = {};
  db.doc(`/moment/${req.params.momentId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Moment not found" });
      }
      momentData = doc.data();
      momentData.momentId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("momentId", "==", req.params.momentId)
        .get();
    })
    .then((data) => {
      momentData.comments = [];
      data.forEach((doc) => {
        momentData.comments.push(doc.data());
      });
      return res.json(momentData);
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// comment on a moment
exports.commentOnMoment = (req, res) => {
  if (req.body.body.trim() === "")
    return res.status(400).json({ error: "Must not be empty" });

  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    momentId: req.params.momentId,
    userHandle: req.user.handle,
    userImage: req.user.imageURL,
  };

  db.doc(`/moment/${req.params.momentId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ comment: "Moment not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch((err) => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};

//like a moment
exports.likeMoment = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("momentId", "==", req.params.momentId)
    .limit(1);

  const momentDocument = db.doc(`/moment/${req.params.momentId}`);

  let momentData;

  momentDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        momentData = doc.data();
        momentData.momentId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "moment not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            momentId: req.params.momentId,
            userHandle: req.user.handle,
          })
          .then(() => {
            momentData.likeCount++;
            return momentDocument.update({ likeCount: momentData.likeCount });
          })
          .then(() => {
            return res.json(momentData);
          });
      } else {
        return res.status(400).json({ error: "moment already liked" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeMoment = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("momentId", "==", req.params.momentId)
    .limit(1);

  const momentDocument = db.doc(`/moment/${req.params.momentId}`);

  let momentData;

  momentDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        momentData = doc.data();
        momentData.momentId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "moment not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "moment not liked" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            momentData.likeCount--;
            return momentDocument.update({ likeCount: momentData.likeCount });
          })
          .then(() => {
            res.json(momentData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

// Delete a moment
exports.deleteMoment = (req, res) => {
  const document = db.doc(`/moment/${req.params.momentId}`);
  document
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Moment not found" });
      }
      if (doc.data().userHandle !== req.user.handle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Moment deleted successfully" });
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
