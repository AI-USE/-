'use strict';

// Configuration for the RTCPeerConnection.
// Using public STUN servers from Google.
const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

class WebRTCManager {
    constructor(isOfferer = false) {
        this.peerConnection = new RTCPeerConnection(configuration);
        this.dataChannel = null;
        this.isOfferer = isOfferer;
        this.onIceRestartNeeded = null; // Callback for signaling

        // Log connection state changes for debugging
        this.peerConnection.onconnectionstatechange = async event => {
            const state = this.peerConnection.connectionState;
            console.log(`WebRTC Connection State: ${state}`);

            if (state === 'failed' && this.isOfferer) {
                console.log('Connection failed, attempting ICE restart...');
                try {
                    const offer = await this.peerConnection.createOffer({ iceRestart: true });
                    await this.peerConnection.setLocalDescription(offer);
                    
                    // Wait for ICE gathering to complete before sending the offer
                    await this.waitForIceGathering();

                    if (this.onIceRestartNeeded) {
                        this.onIceRestartNeeded(this.peerConnection.localDescription);
                    }
                } catch (error) {
                    console.error('ICE restart failed:', error);
                }
            }
        };

        // Log ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = event => {
            console.log(`ICE Connection State: ${this.peerConnection.iceConnectionState}`);
        };

        // Log ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = event => {
            console.log(`ICE Gathering State: ${this.peerConnection.iceGatheringState}`);
        };

        // This event is triggered when the remote peer adds a data channel.
        this.peerConnection.ondatachannel = event => {
            console.log('Data channel received!');
            this.dataChannel = event.channel;
            this.setupDataChannelEvents();
        };
    }

    /**
     * Creates a data channel for communication.
     * This should be called by the initiating peer (the offerer).
     */
    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('chat-channel');
        console.log('Data channel created!');
        this.setupDataChannelEvents();
    }

    /**
     * Sets up the event listeners for the data channel.
     */
    setupDataChannelEvents() {
        this.dataChannel.onopen = event => {
            console.log('Data channel is open!');
            this.startKeepAlive();
        };

        this.dataChannel.onclose = event => {
            console.log('Data channel is closed.');
            this.stopKeepAlive();
        };

        this.dataChannel.onmessage = event => {
            // Handle keep-alive messages
            if (event.data === '__ping__') {
                this.sendMessage('__pong__');
                return;
            }
            if (event.data === '__pong__') {
                // Pong received, connection is alive.
                return;
            }
            // This is where incoming messages will be handled
            console.log('Message received:', event.data);
        };
    }

    /**
     * Starts sending keep-alive pings to maintain the connection.
     */
    startKeepAlive() {
        this.keepAliveInterval = setInterval(() => {
            this.sendMessage('__ping__');
        }, 15000); // Send a ping every 15 seconds
    }

    /**
     * Stops the keep-alive mechanism.
     */
    stopKeepAlive() {
        if (this.keepAliveInterval) {
            clearInterval(this.keepAliveInterval);
            this.keepAliveInterval = null;
        }
    }

    /**
     * Sends a message through the data channel.
     * @param {string} message The message to send.
     */
    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(message);
            // Don't log pings/pongs to avoid clutter
            if (message !== '__ping__' && message !== '__pong__') {
                console.log('Message sent:', message);
            }
        } else {
            console.error('Cannot send message, data channel is not open.');
        }
    }

    /**
     * Waits for the ICE gathering state to become 'complete'.
     * @returns {Promise<void>}
     */
    waitForIceGathering() {
        return new Promise(resolve => {
            if (this.peerConnection.iceGatheringState === 'complete') {
                resolve();
            } else {
                const checkState = () => {
                    if (this.peerConnection.iceGatheringState === 'complete') {
                        this.peerConnection.removeEventListener('icegatheringstatechange', checkState);
                        resolve();
                    }
                };
                this.peerConnection.addEventListener('icegatheringstatechange', checkState);
            }
        });
    }

    /**
     * Creates an offer SDP and waits for all ICE candidates.
     * @returns {Promise<RTCSessionDescriptionInit>} The offer SDP.
     */
    async createOffer() {
        this.createDataChannel();
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
        await this.waitForIceGathering();
        return this.peerConnection.localDescription;
    }

    /**
     * Creates an answer SDP for a received offer.
     * @param {RTCSessionDescriptionInit} offerSdp The received offer.
     * @returns {Promise<RTCSessionDescriptionInit>} The answer SDP.
     */
    async createAnswer(offerSdp) {
        await this.peerConnection.setRemoteDescription(offerSdp);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        await this.waitForIceGathering();
        return this.peerConnection.localDescription;
    }

    /**
     * Sets the remote description with the final answer.
     * @param {RTCSessionDescriptionInit} answerSdp The received answer.
     */
    async setFinalRemoteDescription(answerSdp) {
        await this.peerConnection.setRemoteDescription(answerSdp);
        console.log('Connection should be established now.');
    }
}
