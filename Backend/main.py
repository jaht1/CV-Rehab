import base64
from fastapi import FastAPI, Request, APIRouter
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from fastapi.responses import HTMLResponse 
from fastapi.staticfiles import StaticFiles
from starlette.templating import Jinja2Templates
import socketio
import logging
from app.rom_analysis import analyze_frame, rom_analysis
import cv2
import numpy as np
import json
#from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from aiortc.contrib.media import MediaRelay,MediaStreamError
from av import VideoFrame


app = FastAPI()
router = APIRouter()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

#pcs = set()
relay = MediaRelay()

class VideoTransformTrack(MediaStreamTrack):
    """
    A video stream track that transforms frames from an another track.
    """
    kind = "video"

    def __init__(self, track):
        super().__init__()  # Call the constructor of the base class
        self.track = track
        #self.transform = transform
        print('init!!', track)

    async def recv(self):
        print('in recv....')
        frame = await self.track.recv()
        if frame:
            print('Track received! Try to make changes to it')
             # perform edge detection
            img = frame.to_ndarray(format="bgr24")
            img = cv2.cvtColor(cv2.Canny(img, 100, 200), cv2.COLOR_GRAY2BGR)

            # rebuild a VideoFrame, preserving timing information
            new_frame = VideoFrame.from_ndarray(img, format="bgr24")
            new_frame.pts = frame.pts
            new_frame.time_base = frame.time_base
            self.track = new_frame

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
async def on_connectionstatechange():
    print('connections change')
    
    print("Connection state is %s", pc.connectionState)
    added_tracks = pc.getSenders()

    print("Added tracks:")
    for sender in added_tracks:
        track = sender.track
        if track:
            print("Track ID:", track.id)
            print("Track Kind:", track.kind)
    if pc.connectionState == "failed":
        await pc.close()
@pc.on("track")    
def on_track(track):
    try:
        print('Track received in pc.on?!??!?!? ', track)
        video_track = VideoTransformTrack(relay.subscribe(track))
        #await video_track.recv()
        pc.addTrack(video_track)
        added_tracks = pc.getReceivers()
        
        print("Added tracks:")
        for sender in added_tracks:
            track = sender.track
            if track:
                print("Track ID:", track.id)
                print("Track Kind:", track.kind)
                
        # Print the added track
        print("Track added to peer connection:", pc)
    except Exception as e:
        print('Tried pc.on, failed: ', e)


    
async def subscribe_track(track):
    try:
        print('in subscribe track...')
        relay_track = await relay.subscribe(track)
        print('Succesfully subscribing track!')
        return relay_track
    except Exception as e:
        print('Error subscribing track:', e)
        return None       



@sio.on('offer')
async def offer(sid, data):
    try:
        ''' Function to establish a connection between client and server using WebRTC 
        Receives an offer from the client '''
        
        print('Session id in offer: ', sid)
        # Parsing offer data
        sdp = data['sdp']
        
        offer = RTCSessionDescription(sdp=sdp, type=data["type"])
        # Add video stream to the peer connection
        #await pc.addTrack(MediaStreamTrack(kind="video"))
        # Set the remote description
        
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


    
    
def process_frame_for_analysis(frame):
    '''Function to process frame for ROM analysis model. Processes it according to OpenCV standards. '''
    nparr = np.frombuffer(frame, np.uint8)
    print('processing frame for analysis')
    # Use OpenCV to read the image data as an array (decode)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)
    return frame

"""@sio.on('process_frame')
async def analysis(sid, frame):
    ''' Function that receives a frame from the client '''
    try:
        frame = process_frame_for_analysis(frame)
        # Server script
        angle, frame_bytes = analyze_frame(frame)
        
        await sio.emit('response_back', frame_bytes, to=sid)
    except Exception as err:
        print(f"Unexpected {err=}, {type(err)=}")
        raise"""
    
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