FROM debian:bookworm-slim
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends postfix ca-certificates && rm -rf /var/lib/apt/lists/*
COPY main.cf /etc/postfix/main.cf
COPY allowed-senders /etc/postfix/allowed-senders
RUN postconf -M 'smtp/inet=smtp inet n - n - - smtpd' && postconf -M 'smtp/unix=smtp unix - - n - - smtp'
CMD ["postfix", "start-fg"]
