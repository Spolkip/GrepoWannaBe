import { collection, query, where, getDocs, doc, setDoc, addDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from '../../firebase/config';

export const sendSystemMessage = async (targetUserId, targetUsername, messageText, worldId) => {
    const systemId = 'system';
    const systemUsername = 'System';


    const conversationQuery = query(
        collection(db, 'worlds', worldId, 'conversations'),
        where('participants', 'in', [[systemId, targetUserId], [targetUserId, systemId]])
    );
    const conversationSnapshot = await getDocs(conversationQuery);

    let conversationRef;
    if (conversationSnapshot.empty) {
        conversationRef = doc(collection(db, 'worlds', worldId, 'conversations'));
        await setDoc(conversationRef, {
            participants: [systemId, targetUserId],
            participantUsernames: {
                [systemId]: systemUsername,
                [targetUserId]: targetUsername,
            },
            lastMessage: { text: messageText.substring(0, 30) + '...', senderId: systemId, timestamp: serverTimestamp() },
            readBy: [],
        });
    } else {
        conversationRef = conversationSnapshot.docs[0].ref;
    }


    await addDoc(collection(conversationRef, 'messages'), {
        text: messageText,
        senderId: systemId,
        senderUsername: systemUsername,
        isSystem: true,
        timestamp: serverTimestamp(),
    });


    await updateDoc(conversationRef, {
        lastMessage: { text: messageText.substring(0, 30) + '...', senderId: systemId, timestamp: serverTimestamp() },
        readBy: [],
    });
};
