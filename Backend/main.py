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


app = FastAPI()
router = APIRouter()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

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
        
@sio.on("connect")
async def connect(sid, env):
    print("New Client Connected to This id :"+" "+str(sid))
    
@sio.on("disconnect")
async def disconnect(sid):
    print("Client Disconnected: "+" "+str(sid))


if __name__ == "__main__":
    uvicorn.run(socket_app, host="localhost", port=5000, log_level="debug")