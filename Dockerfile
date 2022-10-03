FROM node
RUN apt-get update && apt-get install -yq \
  vim \
  && apt-get clean
RUN mkdir /tls
RUN openssl req -new -x509 -days 365 -nodes \
  -out /tls/server.cert \
  -keyout /tls/server.key \
  -subj "/C=RO/ST=Bucharest/L=Bucharest/O=IT/CN=www.example.ro"
ADD . /app
WORKDIR /app
RUN npm install
RUN npm install parse-link-header
ENV NODE_TLS_REJECT_UNAUTHORIZED 0
CMD npm run jest
