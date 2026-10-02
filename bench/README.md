# k6 load bench

Measures this HTTP server with [k6](https://k6.io/). The run targets `GET /` on `http://127.0.0.1:<PORT>/` (`PORT` from `.env`, otherwise `5002`). That route returns a body and does not write to the database.

## Install k6

Windows:

```bash
winget install GrafanaLabs.k6
```

macOS:

```bash
brew install k6
```

Linux: follow the install steps at https://k6.io/docs/get-started/installation/

Check that it is on your PATH:

```bash
k6 version
```

## Run

Start the server yourself first (`npm run dev`). The bench will not start, stop, or restart it.

```bash
npm run bench
```

Booking list (`GET http://10.10.26.159:5002/api/v1/booking`) uses the same questions and sends `Authorization: Bearer` from `BENCH_BOOKING_TOKEN` in `.env`:

```bash
npm run bench:booking
```

Answer the prompts in order: scaling, processes, req/s, duration, compression. Only `vertical` runs. `horizontal` prints `not supported yet` and exits.

`all` runs off, gzip, brotli, and zstd one after another. Compression level is 1. If the server does not actually compress with that algorithm at level 1, the run is reported as not supported and is left out of the table.

Each run is saved under `bench/results/` with a timestamp.

## Columns

| Column | Meaning |
| --- | --- |
| Compression | `off`, `gzip`, `brotli`, or `zstd` |
| Req/s | Achieved request rate from k6 `http_reqs`, not the target |
| Data out | Bytes on the wire per second from k6 `data_received` |
| CPU | Average CPU of the server process during the run (the PID listening on the port). This is not the k6 process. |
| p95 | `http_req_duration` p(95), in milliseconds |
| Pass | Responses that were HTTP 2xx with a non-empty body |
| Fail | Responses that did not pass that check |

The winner is the run with fail rate under 1 percent and the highest Req/s. If Req/s ties, the lower p95 wins.
