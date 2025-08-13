const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.updateTotalPoints = functions.firestore
    .document("/users/{uid}/games/{worldId}/cities/{cityId}")
    .onWrite(async (change, context) => {
        const { uid, worldId } = context.params;
        const userGamesRef = admin.firestore().collection("users").doc(uid).collection("games").doc(worldId);

        const citiesSnapshot = await userGamesRef.collection("cities").get();
        let totalPoints = 0;
        citiesSnapshot.forEach(doc => {
            totalPoints += doc.data().totalPoints || 0;
        });

        return userGamesRef.update({ totalPoints });
    });
