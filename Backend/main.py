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


relay = MediaRelay()

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """
    kind = "video"

    def __init__(self, track):
        super().__init__()  
        self.track = track
        print('init!!', track)

    async def recv(self):
        print('in recv....')
        frame = await self.track.recv()
        if frame:
            print('Track received! Try to make changes to it')
            # Convert to numpy array for analysis
            np_frame = frame.to_ndarray(format="bgr24")
            
            #resized_frame = cv2.resize(np_frame, (640, 480))
            processed_frame = analyze_frame(np_frame)
            # Convert processed numpy array back to VideoFrame
            #processed_frame = cv2.flip(np_frame, 1)
            # Create a new VideoFrame object from frame
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
        

@pc.on("track")    
def on_track(track):
    try:
        print('Track received in pc.on?!??!?!? ', track)
        video_track = VideoTransformTrack(relay.subscribe(track))
        print(video_track)
        pc.addTrack(video_track)
    except Exception as e:
        print('Tried pc.on, failed: ', e)



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



    
@sio.on('print_setup')
def print_setup(sid):
    print('PC: ', pc.localDescription.sdp)
    # Print added tracks
    added_tracks = pc.getSenders()
    print("Added Tracks:", added_tracks)
    print('sender len ' + len(sender))
    for sender in added_tracks:
        track = sender.track
        if track:
            print("Track ID:", track.id)
            print("Track Kind:", track.kind)
    
        
@sio.on("connect")
async def connect(sid, env):
    print("New Client Connected to This id :"+" "+str(sid))
    
@sio.on("disconnect")
async def disconnect(sid):
    print("Client Disconnected: "+" "+str(sid))
    
    await pc.close()
    print('closed pc : ', pc)


if __name__ == "__main__":
    uvicorn.run(socket_app, host="localhost", port=5000, log_level="debug")