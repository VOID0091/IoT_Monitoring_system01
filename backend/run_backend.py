import sys
import asyncio

if sys.platform == "win32":
    # Force use of SelectorEventLoop to support socket callbacks used by aiomqtt/paho-mqtt
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn
from app.main import app
from app.core.config import settings

if __name__ == "__main__":
    print(f"Starting server with event loop: {asyncio.get_event_loop_policy().new_event_loop().__class__.__name__}")
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, loop="asyncio", reload=False)
