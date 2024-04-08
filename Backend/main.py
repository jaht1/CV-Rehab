import base64
from fastapi import FastAPI, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from fastapi.responses import HTMLResponse 
from fastapi.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
import socketio
import logging
from app.rom_analysis import analyze_frame
import cv2
import numpy as np
import json
#from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaRelay,MediaStreamError
import av


app = FastAPI()
router = APIRouter()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)
shoulder = ''

relay = MediaRelay()

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """
    kind = "video"

    def __init__(self, track):
        super().__init__()  
        self.track = track

    async def recv(self):
        frame = await self.track.recv()
        if frame:
            # Convert to numpy array for analysis
            np_frame = frame.to_ndarray(format="bgr24")
            
            # Flip image to work as a mirror
            mirrored_frame = cv2.flip(np_frame, 1)
            processed_frame = analyze_frame(mirrored_frame, shoulder)
            # Convert processed numpy array back to VideoFrame
            new_frame = av.VideoFrame.from_ndarray(processed_frame, format="bgr24")
            # Set time stamps to display frame in real-time
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            return new_frame

# Socketio serves under /
app.mount('/', socket_app)

logging.basicConfig(filename='app.log', level=logging.INFO)
logging.error("An error occurred")

# TODO: make a permanent CORS-error fix - this works temporarily
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


pc = RTCPeerConnection()

@pc.on("connectionstatechange")
def connection():
    print('Connection state: ', pc.connectionState)
       

@pc.on("track")    
def on_track(track):
    try:
        video_track = VideoTransformTrack(relay.subscribe(track))
        print(video_track)
        pc.addTrack(video_track)
    except Exception as e:
        print('Peerconnection track failed: ', e)


@sio.on('assign_shoulder')
def assign_shoulder(sid, shoulder_choice):
    ''' Function that receives shoulder choice from the client. '''
    try:
        global shoulder
        shoulder = shoulder_choice
        print('Shoulder: ', shoulder)
        return
    except Exception as e:
        print('Error assigning shoulder: ', e)

@sio.on('offer')
async def offer(sid, data):
    try:
        ''' Function to establish a connection between client and server using WebRTC 
        Receives an offer from the client '''
        
        print('Session id in offer: ', sid)
        # Parsing offer data
        sdp = data['sdp']
        
        offer = RTCSessionDescription(sdp=sdp, type=data["type"])
        await pc.setRemoteDescription(offer)
        # Create an answer
        answer = await pc.createAnswer()
        # Set the local description
        await pc.setLocalDescription(answer)
        # Send the answer back to the client
        print('Succesfully received offer, returning answer')
        await sio.emit('answer', {'sdp': pc.localDescription.sdp, 'type': pc.localDescription.type}, room=sid)
    except Exception as e:
        print('Problem with offer: ', e)

@sio.on('get_logs')
def logs(sid):
    try:
        with open('/Measurements.txt', 'rb') as file:
            lines = file.read().splitlines()
            if lines:
                sio.emit('log', lines[-1])
            else:
                # Return None if the file is empty
                return None  
    except Exception as e:
        print('Failed to read file: ', e)
        


@sio.on('pc_reset')
async def reset(sid):
    global pc
    pc = RTCPeerConnection()
    print('Connection closed')
        
@sio.on("connect")
async def connect(sid, env):
    print("New Client Connected to This id : ", str(sid))
    
@sio.on("disconnect")
async def disconnect(sid):
    print("Client Disconnected: ", str(sid))
    global pc
    print('Connection closed')
    await pc.close()
    
    print('closed pc : ', pc)


if __name__ == "__main__":
    uvicorn.run(socket_app, host="localhost", port=5000, log_level="debug")