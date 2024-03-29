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

class VideoTransformTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, track):
        super().__init__()  # Call the constructor of the base class
        self.track = track
        #self.transform = transform
        print('init!!')

    async def recv(self):
        print('in recv....')
        frame = await self.track.recv()
        if frame:
            print('Track received! Try to make changes to it')

            img = frame.to_ndarray(format="bgr24")
            img = cv2.flip(img, 1)
            return img
            frame_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            angle, frame = analyze_frame(frame)
            print('Succesfully processed frame before analysis')
            return frame

                
            '''print('Track received! Try to make changes to it')

            img = frame.to_ndarray(format="bgr24")
            frame_bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            angle, frame = analyze_frame(frame)
            print('Succesfully processed frame before analysis')
            return frame'''
    
        
        
        
'''async def renegotiate():
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
    await renegotiate()'''
    
'''@pc.on("connectionstatechange")
async def on_connectionstatechange():
    print("Connection state is: ", pc.connectionState)
    if pc.connectionState == "closed":
        
        try:
            senders = pc.getSenders()
            
            # Stop each track to release the resources
            for sender in senders:
                track = sender.track
                if track:
                    track.enabled = False
                    track.stop()
                    
            print('senders: ', senders)
            await pc.close()
            print('connection is closed.')
        except Exception as e:
            print('error: ', e)
        #pcs.discard(pc)   '''
    
async def subscribe_track(track):
    try:
        print('in subscribe track...')
        relay_track = relay.subscribe(track)
        print('Succesfully subscribing track!')
        return relay_track
    except Exception as e:
        print('Error subscribing track:', e)
        return None       



'''@sio.on("icecandidate")
async def handle_icecandidate(sid, data):
    candidate = data["candidate"]
    await pc.addIceCandidate(candidate)
'''
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
        @pc.on("track")    
        async def on_track(track):
            try:
                print('Track received in pc.on?!??!?!? ', track)
                video_track = VideoTransformTrack(relay.subscribe(track))
                pc.addTrack(video_track)

                # Print the added track
                print("Track added to peer connection:", video_track)
            except Exception as e:
                print('Tried pc.on, failed: ', e)

        @pc.on("datachannel")
        def on_datachannel(channel):
            @channel.on("video")
            def on_message(message):
                if isinstance(message, str) and message.startswith("ping"):
                    channel.send("pong" + message[4:])
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

"""@sio.on('answer')
async def answer(sid, answer):
    ''' Function to set remote description on the server-side peer connection '''
    answer_description = RTCSessionDescription(type="offer", sdp=answer["sdp"])
    print('Setting remote description in server...')
    await pc.setRemoteDescription(answer_description)
    print('Description successfully set in server.')"""
    
    
    
    
    
'''@sio.on('add_track')
def add_track(sid, stream):
    try:
        print('adding track...')
        track_data = json.loads(stream)
        kind = track_data['kind']
        track_id = track_data['id']
        label = track_data['label']
        print('track data: ', track_data)
        relay_track = relay.subscribe(kind=kind, label=label, id=track_id)
        #track = MediaStreamTrack(track_data)
        video_track = VideoStreamTrack(relay_track)
        pc.addTrack(video_track)
        print('succesfully added track: ', video_track)
    except Exception as e:
        print('Something went wrong with adding track: ', e)
    '''

    
    
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