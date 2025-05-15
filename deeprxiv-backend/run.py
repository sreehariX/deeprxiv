import uvicorn

if __name__ == "__main__":
    # Use 127.0.0.1 explicitly for IPv4 compatibility with the frontend
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True) 