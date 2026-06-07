setup-edge:
	docker build -t edge-streamer .

run-edge: setup-edge
	docker run edge-streamer

setup-asr:
	docker build -t multi-asr-server .

run-asr: setup-asr
	docker run -p 3010:3010 multi-asr-server
