'use strict';

class AppState {
    constructor() {
        this.webRtcManager = null;
        this.stream = null;
        this.pushManager = null;
        this.cryptoManager = null;
        this.peerPushSubscription = null;
        this.peerUnreadListCid = null;
        this.myUnreadListCid = null;
    }

    static getInstance() {
        if (!AppState.instance) {
            AppState.instance = new AppState();
        }
        return AppState.instance;
    }

    reset() {
        // Reset state for new connections without re-instantiating
        this.webRtcManager = null;
        this.stream = null;
        this.pushManager = null;
        this.cryptoManager = null;
        this.peerPushSubscription = null;
        this.peerUnreadListCid = null;
        this.myUnreadListCid = null;
    }
}
AppState.instance = null;


// Register Service Worker for Push Notifications
if ('serviceWorker' in navigator && 'PushManager' in window) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(swReg => {
                console.log('Service Worker is registered', swReg);
            })
            .catch(err => {
                console.error('Service Worker Error', err);
            });
    });

    // Listen for messages from the Service Worker
    navigator.serviceWorker.addEventListener('message', event => {
        console.log('Message from SW:', event.data);
        const { type, payload } = event.data;
        if (type === 'ice_restart_offer') {
            handleIceRestartOffer(payload);
        } else if (type === 'ice_restart_answer') {
            handleIceRestartAnswer(payload);
        }
    });
} else {
    console.warn('Push messaging is not supported');
}


// Konami Code sequence
const konamiCode = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 
    'b', 'a'
];

let index = 0;

function onKeyDown(event) {
    if (event.key === konamiCode[index]) {
        index++;
        if (index === konamiCode.length) {
            // Konami code entered correctly
            activateChat();
            index = 0; // Reset for next time
        }
    } else {
        index = 0; // Reset if the sequence is broken
    }
}

function activateChat() {
    console.log('Secret code activated.');
    const savedSession = StorageManager.loadSession();

    if (savedSession) {
        showPasswordUI(savedSession);
    } else {
        showInitialConnectionUI();
    }
}

function showPasswordUI(sessionData) {
    console.log('Existing session found. Showing password prompt.');
    document.body.innerHTML = `
        <div id="chat-container">
            <h1>Welcome Back</h1>
            <p>Enter your password to unlock the session.</p>
            <input type="password" id="password-input" placeholder="Password">
            <button id="unlock-button">Unlock</button>
        </div>
    `;

    document.getElementById('unlock-button').addEventListener('click', async () => {
        const password = document.getElementById('password-input').value;
        if (!password) {
            alert('Password is required.');
            return;
        }

        // Initialize IPFS client (token is already saved)
        initializeIpfsClient(StorageManager.loadApiToken());

        // Restore state from session
        const appState = AppState.getInstance();
        appState.reset();
        appState.peerPushSubscription = sessionData.peerPushSubscription;
        appState.myUnreadListCid = sessionData.myUnreadListCid;
        appState.peerUnreadListCid = sessionData.peerUnreadListCid;

        // Derive key and start chat
        appState.cryptoManager = new CryptoManager();
        const salt = appState.cryptoManager.base64ToArrayBuffer(sessionData.salt);
        await appState.cryptoManager.deriveKeyFromPassword(password, salt);
        
        // At this point we don't have a WebRTC connection.
        // The app will rely on offline messaging and ICE restart to connect.
        showChatInterface();
        checkUnreadMessages();
    });
}

function showInitialConnectionUI() {
    console.log('No session found. Showing initial connection UI.');

    // --- API Token Management ---
    const updateApiToken = () => {
        const newToken = prompt('Please enter your web3.storage API token:');
        if (newToken) {
            StorageManager.saveApiToken(newToken);
            initializeIpfsClient(newToken);
            document.getElementById('api-token-status').textContent = `Current API Token: ...${newToken.slice(-4)}`;
        } else if (!StorageManager.loadApiToken()) {
             alert('IPFS features require an API token.');
        }
    };
    let apiToken = StorageManager.loadApiToken();
    if (!apiToken || apiToken === '') {
        updateApiToken();
        apiToken = StorageManager.loadApiToken();
        if (!apiToken) return;
    } else {
        initializeIpfsClient(apiToken);
    }

    // --- Worker URL Management ---
    const updateWorkerUrl = () => {
        const newUrl = prompt('Please enter your Push Worker URL:');
        if (newUrl) {
            StorageManager.saveWorkerUrl(newUrl);
            document.getElementById('worker-url-status').textContent = `Current Worker URL: ${newUrl}`;
        } else if (!StorageManager.loadWorkerUrl()) {
            alert('Push notifications require a Worker URL.');
        }
    };
    let workerUrl = StorageManager.loadWorkerUrl();
    if (!workerUrl || workerUrl === '') {
        updateWorkerUrl();
        workerUrl = StorageManager.loadWorkerUrl();
        if (!workerUrl) return;
    }
    
    document.body.innerHTML = `
        <div id="chat-container">
            <h1>Secure P2P Chat Setup</h1>
            <div id="config-section">
                <p id="api-token-status">Current API Token: ...${apiToken.slice(-4)}</p>
                <button id="update-token-button">Update Token</button>
                <p id="worker-url-status">Current Worker URL: ${workerUrl}</p>
                <button id="update-worker-url-button">Update Worker URL</button>
            </div>
            <hr>
            <div id="connection-setup">
                <button id="create-invitation">Create Invitation (I am Peer A)</button>
                <button id="scan-invitation">Scan Invitation (I am Peer B)</button>
            </div>
            <div id="qr-display">
                <canvas id="qr-canvas"></canvas>
            </div>
            <div id="scanner-container" style="display: none;">
                <video id="scanner-video" playsinline></video>
                <p>Scanning...</p>
            </div>
            <div id="chat-interface" style="display: none;">
                <div id="messages"></div>
                <input type="text" id="message-input" placeholder="Enter message...">
                <button id="send-button">Send</button>
            </div>
             <button id="reset-session" style="margin-top: 20px;">Reset Session</button>
        </div>
    `;

    document.getElementById('update-token-button').addEventListener('click', updateApiToken);
    document.getElementById('update-worker-url-button').addEventListener('click', updateWorkerUrl);
    document.getElementById('create-invitation').addEventListener('click', createInvitation);
    document.getElementById('scan-invitation').addEventListener('click', scanInvitation);
    document.getElementById('reset-session').addEventListener('click', () => {
        StorageManager.clearSession();
        StorageManager.saveApiToken(''); // Also clear the token for a full reset
        alert('Session and API Token have been reset.');
        activateChat();
    });
}

// VAPID public key for push notifications.
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yQv_vPO0HCd2d9tEASlnvr2T06hkhg_Es_i1-e-2b_D-Q2y1Jg8V1Yv3E_g-h2K2B4-A';


async function createInvitation() {
    console.log('Creating invitation...');
    document.getElementById('connection-setup').style.display = 'none';
    
    const appState = AppState.getInstance();
    appState.reset();

    appState.webRtcManager = new WebRTCManager(true); // This peer is the offerer
    appState.pushManager = new PushManager();
    appState.cryptoManager = new CryptoManager();

    try {
        // 1. Get password from user
        const password = prompt('Please enter a strong password for this chat session:');
        if (!password) {
            alert('A password is required.');
            return;
        }

        // 2. Subscribe to push notifications
        const mySubscription = await appState.pushManager.subscribeUser(VAPID_PUBLIC_KEY);
        if (!mySubscription) {
            throw new Error('Push subscription failed. Please grant notification permission.');
        }

        // 3. Create an initial empty unread list on IPFS
        appState.myUnreadListCid = await uploadToIPFS(JSON.stringify([]));

        // 4. Generate salt and derive the encryption key
        const salt = appState.cryptoManager.generateSalt();
        await appState.cryptoManager.deriveKeyFromPassword(password, salt);
        
        // 5. Create WebRTC offer
        const offerSdp = await appState.webRtcManager.createOffer();

        // 6. Bundle everything into the offer payload
        const offerPayload = {
            sdp: offerSdp,
            pushSubscription: mySubscription,
            unreadListCid: appState.myUnreadListCid,
            salt: appState.cryptoManager.arrayBufferToBase64(salt) // Add salt to payload
        };
        const cid = await uploadToIPFS(JSON.stringify(offerPayload));
        console.log('Offer payload uploaded to IPFS. CID:', cid);
        
        // 5. Generate QR code
        const invitation = JSON.stringify({ type: 'offer', cid });
        const canvas = document.getElementById('qr-canvas');
        QRCode.toCanvas(canvas, invitation, (error) => {
            if (error) console.error(error);
            console.log('Invitation QR code generated!');
        });

        // 6. Wait to scan the answer, and set up connection listener
        appState.webRtcManager.peerConnection.onconnectionstatechange = () => {
            if (appState.webRtcManager.peerConnection.connectionState === 'connected') {
                console.log('Connection established!');
                setupChatHandlers(appState);

                const sessionData = {
                    peerPushSubscription: appState.peerPushSubscription,
                    myUnreadListCid: appState.myUnreadListCid,
                    peerUnreadListCid: appState.peerUnreadListCid,
                    salt: appState.cryptoManager.arrayBufferToBase64(salt)
                };
                StorageManager.saveSession(sessionData);

                showChatInterface();
                checkUnreadMessages();
            }
        };

        await startScanner('answer');
    } catch (error) {
        console.error('Failed to create invitation:', error);
        alert(error.message); // Provide feedback to the user
    }
}

async function scanInvitation() {
    console.log('Scanning invitation...');
    document.getElementById('connection-setup').style.display = 'none';
    await startScanner('offer');
}

function stopScanner() {
    if (AppState.getInstance().stream) {
        AppState.getInstance().stream.getTracks().forEach(track => track.stop());
        AppState.getInstance().stream = null;
    }
    const scannerContainer = document.getElementById('scanner-container');
    scannerContainer.style.display = 'none';
}

async function startScanner(scanType) {
    const scannerContainer = document.getElementById('scanner-container');
    const video = document.getElementById('scanner-video');
    scannerContainer.style.display = 'block';

    try {
        AppState.getInstance().stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        video.srcObject = AppState.getInstance().stream;
        video.play();

        requestAnimationFrame(tick);

        function tick() {
            if (video.readyState === video.HAVE_ENOUGH_DATA) {
                const canvasElement = document.createElement('canvas');
                const canvas = canvasElement.getContext('2d');
                canvasElement.height = video.videoHeight;
                canvasElement.width = video.videoWidth;
                canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);
                const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'dontInvert',
                });

                if (code) {
                    stopScanner();
                    console.log('QR Code detected:', code.data);
                    handleScannedData(code.data, scanType);
                    return;
                }
            }
            if (AppState.getInstance().stream) { // Check if scanner is still active
                requestAnimationFrame(tick);
            }
        }
    } catch (error) {
        console.error('Failed to start scanner:', error);
    }
}

async function handleScannedData(data, expectedType) {
    try {
        const parsedData = JSON.parse(data);
        if (parsedData.type !== expectedType) {
            throw new Error(`Unexpected QR code type. Expected ${expectedType}, got ${parsedData.type}`);
        }

        if (parsedData.type === 'offer') {
            console.log('Handling offer...');
            const appState = AppState.getInstance();
            appState.reset();

            appState.webRtcManager = new WebRTCManager(false); // This peer is the answerer
            appState.pushManager = new PushManager();
            appState.cryptoManager = new CryptoManager();

            const offerPayload = JSON.parse(await downloadFromIPFS(parsedData.cid));
            
            // Store peer's info
            appState.peerPushSubscription = offerPayload.pushSubscription;
            appState.peerUnreadListCid = offerPayload.unreadListCid;
            
            // Get password and derive the key using the received salt
            const password = prompt('Enter the password for this chat session:');
            if (!password) {
                alert('A password is required to join.');
                return;
            }
            const salt = appState.cryptoManager.base64ToArrayBuffer(offerPayload.salt);
            await appState.cryptoManager.deriveKeyFromPassword(password, salt);

            // Subscribe to push and create our own unread list
            const mySubscription = await AppState.getInstance().pushManager.subscribeUser(VAPID_PUBLIC_KEY);
            AppState.getInstance().myUnreadListCid = await uploadToIPFS(JSON.stringify([]));

            const answerSdp = await AppState.getInstance().webRtcManager.createAnswer(offerPayload.sdp);

            const answerPayload = {
                sdp: answerSdp,
                pushSubscription: mySubscription,
                unreadListCid: AppState.getInstance().myUnreadListCid
            };
            const cid = await uploadToIPFS(JSON.stringify(answerPayload));
            console.log('Answer payload uploaded to IPFS. CID:', cid);

            const answer = JSON.stringify({ type: 'answer', cid });
            const canvas = document.getElementById('qr-canvas');
            document.getElementById('qr-display').style.display = 'block';
            QRCode.toCanvas(canvas, answer, (error) => {
                if (error) console.error(error);
                console.log('Answer QR code generated!');
            });
            
            // Set up connection listener
            appState.webRtcManager.peerConnection.onconnectionstatechange = () => {
                if (appState.webRtcManager.peerConnection.connectionState === 'connected') {
                    console.log('Connection established!');
                    setupChatHandlers(appState);

                    // Save session state once connected
                    const sessionData = {
                        peerPushSubscription: appState.peerPushSubscription,
                        myUnreadListCid: appState.myUnreadListCid,
                        peerUnreadListCid: appState.peerUnreadListCid,
                        salt: appState.cryptoManager.arrayBufferToBase64(salt)
                    };
                    StorageManager.saveSession(sessionData);

                    showChatInterface();
                    checkUnreadMessages();
                }
            }

        } else if (parsedData.type === 'answer') {
            console.log('Handling answer...');
            const answerPayload = JSON.parse(await downloadFromIPFS(parsedData.cid));
            
            // Store peer's info
            AppState.getInstance().peerPushSubscription = answerPayload.pushSubscription;
            AppState.getInstance().peerUnreadListCid = answerPayload.unreadListCid;

            await AppState.getInstance().webRtcManager.setFinalRemoteDescription(answerPayload.sdp);
             // Connection state change handler in createInvitation will now trigger
        }

    } catch (error) {
        console.error('Error handling scanned data:', error);
        alert('Failed to handle invitation. Please try again.');
    }
}

function showChatInterface() {
    const appState = AppState.getInstance();
    
    // The chat interface HTML might not be on the page if we came from the password screen.
    if (!document.getElementById('chat-interface')) {
        document.body.innerHTML = `
            <div id="chat-container">
                 <h1>Secure P2P Chat</h1>
                 <div id="chat-interface">
                    <div id="messages"></div>
                    <input type="text" id="message-input" placeholder="Enter message...">
                    <button id="send-button">Send</button>
                </div>
                <button id="reset-session" style="margin-top: 20px;">Reset Session</button>
            </div>
        `;
        document.getElementById('reset-session').addEventListener('click', () => {
            StorageManager.clearSession();
            alert('Session has been reset.');
            activateChat();
        });
    }

    console.log('Showing chat interface.');
    
    if (document.getElementById('connection-setup')) {
        document.getElementById('connection-setup').style.display = 'none';
        document.getElementById('qr-display').style.display = 'none';
        stopScanner();
    }
    
    document.getElementById('chat-interface').style.display = 'block';

    const sendButton = document.getElementById('send-button');
    const messageInput = document.getElementById('message-input');
    const messagesDiv = document.getElementById('messages');

    const displayMessage = (text, sender) => {
        const p = document.createElement('p');
        p.textContent = `${sender}: ${text}`;
        if (sender === 'You') {
            p.style.textAlign = 'right';
        }
        messagesDiv.appendChild(p);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    };

    sendButton.onclick = () => {
        const message = messageInput.value;
        if (message.trim() === '') return;

        displayMessage(message, 'You');
        messageInput.value = '';

        if (AppState.getInstance().webRtcManager && AppState.getInstance().webRtcManager.peerConnection.connectionState === 'connected') {
            AppState.getInstance().cryptoManager.encrypt(message).then(encryptedMessage => {
                AppState.getInstance().webRtcManager.sendMessage(encryptedMessage);
            });
        } else {
            sendOfflineMessage(message);
        }
    };

    AppState.getInstance().webRtcManager.dataChannel.onmessage = (event) => {
        if (event.data === '__ping__' || event.data === '__pong__') return;
        
        AppState.getInstance().cryptoManager.decrypt(event.data).then(decryptedMessage => {
            displayMessage(decryptedMessage, 'Peer');
        }).catch(err => console.error('Decryption failed:', err));
    };
}

async function sendOfflineMessage(message) {
    console.log('Peer is offline. Sending message via IPFS...');
    try {
        // 1. Encrypt the message
        const encryptedMessage = await AppState.getInstance().cryptoManager.encrypt(message);
        
        // 2. Upload the encrypted message content to IPFS
        const messageCid = await uploadToIPFS(encryptedMessage);

        // 2. Get the peer's current unread list
        const unreadList = JSON.parse(await downloadFromIPFS(AppState.getInstance().peerUnreadListCid));

        // 3. Add the new message CID to the list
        unreadList.push(messageCid);

        // 4. Upload the new unread list to IPFS
        const newUnreadListCid = await uploadToIPFS(JSON.stringify(unreadList));
        
        // 5. IMPORTANT: Update the peer's unread list CID for the next message
        AppState.getInstance().peerUnreadListCid = newUnreadListCid;

        // 6. Send a push notification to the peer
        const workerUrl = StorageManager.loadWorkerUrl();
        if (!workerUrl) {
            alert('Push Worker URL is not set. Cannot send offline notification.');
            return;
        }
        await AppState.getInstance().pushManager.sendNotification(AppState.getInstance().peerPushSubscription, {
            type: 'new_message',
            cid: newUnreadListCid 
        }, workerUrl);

        console.log(`Message stored on IPFS. New unread list CID: ${newUnreadListCid}`);

    } catch (error) {
        console.error('Failed to send offline message:', error);
    }
}

async function checkUnreadMessages() {
    console.log('Checking for unread messages...');
    try {
        const unreadList = JSON.parse(await downloadFromIPFS(AppState.getInstance().myUnreadListCid));

        if (unreadList.length > 0) {
            console.log(`Found ${unreadList.length} unread messages.`);
            const messagesDiv = document.getElementById('messages');

            for (const messageCid of unreadList) {
                const encryptedMessage = await downloadFromIPFS(messageCid);
                const message = await AppState.getInstance().cryptoManager.decrypt(encryptedMessage);
                const p = document.createElement('p');
                p.textContent = `Peer: ${message}`;
                messagesDiv.appendChild(p);
            }
            messagesDiv.scrollTop = messagesDiv.scrollHeight;

            // Clear the unread list
            AppState.getInstance().myUnreadListCid = await uploadToIPFS(JSON.stringify([]));
            console.log('Unread messages cleared. New list CID:', AppState.getInstance().myUnreadListCid);
        } else {
            console.log('No unread messages.');
        }
    } catch (error) {
        console.error('Failed to check unread messages:', error);
    }
}


async function handleIceRestartOffer(payload) {
    if (!AppState.getInstance().webRtcManager || !AppState.getInstance().peerPushSubscription) {
        console.warn('Received ICE restart offer but not ready to handle it.');
        return;
    }

    console.log('Handling ICE restart offer...');
    try {
        // 1. Download the offer SDP from IPFS
        const offerSdp = JSON.parse(await downloadFromIPFS(payload.cid));

        // 2. Create an answer
        const answerSdp = await AppState.getInstance().webRtcManager.createAnswer(offerSdp);

        // 3. Upload the answer SDP to IPFS
        const answerCid = await uploadToIPFS(JSON.stringify(answerSdp));

        // 4. Send the answer back via a push notification
        const workerUrl = StorageManager.loadWorkerUrl();
        if (!workerUrl) {
            alert('Push Worker URL is not set. Cannot send ICE restart notification.');
            return;
        }
        await AppState.getInstance().pushManager.sendNotification(AppState.getInstance().peerPushSubscription, {
            type: 'ice_restart_answer',
            cid: answerCid
        }, workerUrl);

        console.log('ICE restart answer sent.');
    } catch (error) {
        console.error('Failed to handle ICE restart offer:', error);
    }
}

async function handleIceRestartAnswer(payload) {
    if (!AppState.getInstance().webRtcManager) {
        console.warn('Received ICE restart answer but WebRTCManager is not initialized.');
        return;
    }
    console.log('Handling ICE restart answer...');
    try {
        const answerSdp = JSON.parse(await downloadFromIPFS(payload.cid));
        await AppState.getInstance().webRtcManager.setFinalRemoteDescription(answerSdp);
        console.log('ICE restart complete. Connection should be restored.');
    } catch (error) {
        console.error('Failed to handle ICE restart answer:', error);
    }
}

function setupChatHandlers(appState) {
    appState.webRtcManager.onIceRestartNeeded = async (offerSdp) => {
        console.log('ICE Restart Needed. Sending new offer via IPFS and Push...');
        try {
            const cid = await uploadToIPFS(JSON.stringify(offerSdp));
            const workerUrl = StorageManager.loadWorkerUrl();
            if (!workerUrl) {
                alert('Push Worker URL is not set. Cannot send ICE restart notification.');
                return;
            }
            await appState.pushManager.sendNotification(appState.peerPushSubscription, {
                type: 'ice_restart',
                cid: cid
            }, workerUrl);
            console.log('ICE restart offer sent.');
        } catch (error) {
            console.error('Failed to send ICE restart offer:', error);
        }
    };

    appState.webRtcManager.dataChannel.onmessage = (event) => {
        if (event.data === '__ping__' || event.data === '__pong__') return;
        
        appState.cryptoManager.decrypt(event.data).then(decryptedMessage => {
            displayMessage(decryptedMessage, 'Peer');
        }).catch(err => console.error('Decryption failed:', err));
    };
}

document.addEventListener('keydown', onKeyDown);
