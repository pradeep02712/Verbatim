const WebSocket = require('ws');
const wrtc = require('wrtc');
const { spawn } = require('child_process');
const PORT = process.env.PORT || 3010;

// Set up logging
const logger = require('winston');
logger.configure({
    level: 'info',
    transports: [
        new logger.transports.Console({ format: logger.format.simple() })
    ]
});

// Start WebSocket server
const wss = new WebSocket.Server({ port: PORT });
logger.info(`WebSocket signaling server started on ws://multi-asr-server:${PORT}`);

// Handle each WebSocket signaling connection
wss.on('connection', (ws) => {
    logger.info("New signaling connection established");

    // Create a queue for this connection
    const messageQueue = [];

    // Set up an async function to process messages for this connection
    const processQueue = async () => {
        while (messageQueue.length > 0) {
            const message = messageQueue.shift();
            await handleMessage(ws, message);
        }
    };

    // Push messages to the queue and start processing
    ws.on('message', async (message) => {
        messageQueue.push(message); // Add to this connection's queue
        processQueue(); // Start processing the queue
    });

    // Cleanup when connection closes
    ws.on('close', () => {
        logger.info("Connection closed, cleaning up.");
    });
});

// Function to handle individual messages
async function handleMessage(ws, message) {
    logger.info("Received message from client:", message);
    const { type, sdp, candidate } = JSON.parse(message);

    if (type === 'offer') {
        const peerConnection = await handleWebRTCConnection(ws, sdp);
        setupTranscription(peerConnection);
    } else if (type === 'candidate') {
        await addIceCandidate(ws, candidate);
    }
}

// Function to handle WebRTC connection setup
async function handleWebRTCConnection(ws, sdpOffer) {
    const peerConnection = new wrtc.RTCPeerConnection();

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
            logger.info("Sent ICE candidate to client:", event.candidate);
        }
    };

    // Log connection and signaling state changes
    peerConnection.onconnectionstatechange = () => {
        logger.info(`Connection state: ${peerConnection.connectionState}`);
    };
    peerConnection.onsignalingstatechange = () => {
        logger.info(`Signaling state: ${peerConnection.signalingState}`);
    };

    // Set the remote SDP offer
    await peerConnection.setRemoteDescription(new wrtc.RTCSessionDescription({ type: 'offer', sdp: sdpOffer }));

    // Create and send SDP answer
    const sdpAnswer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(sdpAnswer);
    ws.send(JSON.stringify({ type: 'answer', sdp: sdpAnswer.sdp }));
    logger.info("Sent SDP answer to client");

    return peerConnection;
}

// Function to handle incoming ICE candidate
async function addIceCandidate(ws, candidateData) {
    try {
        const candidate = new wrtc.RTCIceCandidate(candidateData);
        await peerConnection.addIceCandidate(candidate);
        logger.info("Added ICE candidate from client");
    } catch (error) {
        logger.error("Error adding ICE candidate:", error);
    }
}

// Function to handle transcription
function setupTranscription(peerConnection) {
    peerConnection.ontrack = (event) => {
        logger.info("New audio track received for transcription");

        const audioTrack = event.track;
        if (audioTrack.kind === 'audio') {
            const pythonProcess = spawn('python3', ['asr/asr_engine.py']);

            audioTrack.ondata = (data) => {
                pythonProcess.stdin.write(data);
                logger.info("Audio data received and forwarded to ASR engine");
            };

            pythonProcess.stdout.on('data', (transcription) => {
                logger.info(`Transcription result: ${transcription.toString()}`);
            });

            pythonProcess.stderr.on('data', (error) => {
                logger.error(`Error in ASR engine: ${error.toString()}`);
            });

            pythonProcess.on('close', (code) => {
                logger.info(`ASR process exited with code ${code}`);
            });
        }
    };
}

// Error handling for server
process.on('uncaughtException', (error) => {
    logger.error(`Uncaught Exception: ${error}`);
});
process.on('unhandledRejection', (error) => {
    logger.error(`Unhandled Rejection: ${error}`);
});

logger.info("WebSocket signaling server is running...");
