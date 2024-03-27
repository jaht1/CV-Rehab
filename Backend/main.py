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

#from aiohttp import web
from aiortc import MediaStreamTrack, RTCPeerConnection, RTCSessionDescription
from aiortc.contrib.media import MediaRelay

app = FastAPI()
router = APIRouter()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

pcs = set()
pc = RTCPeerConnection()
relay = MediaRelay()


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

async def renegotiate():
    # Create a new offer
    new_offer = await pc.createOffer()

    # Set the local description to the new offer
    await pc.setLocalDescription(new_offer)

    # Send the new offer to the remote peer
    await sio.emit('offer', {'sdp': pc.localDescription.sdp, 'type': pc.localDescription.type})

# Set up an event listener for the "negotiationneeded" event
@pc.on("negotiationneeded")
async def on_negotiationneeded():
    print("Negotiation needed. Renegotiating...")
    await renegotiate()
    
pc.on("track")    
def on_track(track):
    print('Track received')





@sio.on('offer')
async def offer(sid, data):
    ''' Function to establish a connection between client and server using WebRTC '''
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
    await sio.emit('answer', {'sdp': pc.localDescription.sdp, 'type': pc.localDescription.type}, room=sid)

@sio.on('answer')
async def answer(sid, answer):
    ''' Function to set remote description on the server-side peer connection '''
    answer_description = RTCSessionDescription(type="offer", sdp=answer["sdp"])
    print('Setting remote description in server...')
    await pc.setRemoteDescription(answer_description)
    print('Description successfully set in server.')
    
    
    
    
    
@sio.on('add_track')
def add_track(sid, stream):
    print('adding track...')
    print(stream)
    video_track = stream.getVideoTracks()[0]
    print(video_track)
    pc.addTrack(video_track)
    print('succesfully added track', stream)
    

    
def handle_track(track, _):
    print('Received video track:')
    
def process_frame_for_analysis(frame):
    '''Function to process frame for ROM analysis model. Processes it according to OpenCV standards. '''
    nparr = np.frombuffer(frame, np.uint8)
    print('processing frame for analysis')
    # Use OpenCV to read the image data as an array (decode)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    frame = cv2.cvtColor(frame, cv2.COLOR_RGB2BGR)

    return frame

@sio.on('process_frame')
async def analysis(sid, frame):
    ''' Function that receives a frame from the client '''
    try:
        frame = process_frame_for_analysis(frame)
        # Server script
        angle, frame_bytes = analyze_frame(frame)
        
        await sio.emit('response_back', frame_bytes, to=sid)
    except Exception as err:
        print(f"Unexpected {err=}, {type(err)=}")
        raise
    
@sio.on('print_setup')
def print_setup(sid):
    print('PC: ', pc.localDescription.sdp)
    # Print added tracks
    added_tracks = pc.getSenders()
    print("Added Tracks:")
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


if __name__ == "__main__":
    uvicorn.run(socket_app, host="localhost", port=5000, log_level="debug")