import * as openpgp from 'openpgp';
import Message from '../models/messages.schema';

const serverPrivateKey = `-----BEGIN PGP PRIVATE KEY BLOCK-----
...
-----END PGP PRIVATE KEY BLOCK-----`;

const passphrase = 'super long and hard to guess secret';

async function decryptMessage(encryptedMessage: string): Promise<string> {
  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: serverPrivateKey }),
    passphrase
  });

  const message = await openpgp.readMessage({
    armoredMessage: encryptedMessage
  });

  const { data: decryptedMessage } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey
  });

  return decryptedMessage;
}

export async function sendMessageToParticipants(messageId: string) {
  const message = await Message.findById(messageId);

  if (!message) {
    throw new Error('Message not found');
  }

  const decryptedMessage = await decryptMessage(message.message);

  // Logic to send the decrypted message to all participants
  // For example, using a WebSocket or any other real-time communication method
}
