if ! test -z "$3" 
then
  SSL_PATH=$3/
fi

echo ${SSL_PATH:+$SSL_PATH}cert.key

openssl genrsa -out ${SSL_PATH:+$SSL_PATH}cert.key 2048
openssl rsa -in ${SSL_PATH:+$SSL_PATH}cert.key -out ${SSL_PATH:+$SSL_PATH}cert.key

echo "[req]" > ${SSL_PATH:+$SSL_PATH}cert.config
echo "distinguished_name=req" >> ${SSL_PATH:+$SSL_PATH}cert.config
echo "[san]" >> ${SSL_PATH:+$SSL_PATH}cert.config

if test -z "$1" 
then
  echo "subjectAltName=DNS:localhost,example.com,127.0.0.1" >> ${SSL_PATH:+$SSL_PATH}cert.config
else
  echo "subjectAltName=DNS:localhost,example.com,127.0.0.1,${1}" >> ${SSL_PATH:+$SSL_PATH}cert.config
fi

if test -z "$2" 
then
  openssl req -sha256 -new -key ${SSL_PATH:+$SSL_PATH}cert.key -out ${SSL_PATH:+$SSL_PATH}cert.csr -subj "/CN=localhost" -config ${SSL_PATH:+$SSL_PATH}cert.config
else
  openssl req -sha256 -new -key ${SSL_PATH:+$SSL_PATH}cert.key -out ${SSL_PATH:+$SSL_PATH}cert.csr -subj "/CN=${2}" -config ${SSL_PATH:+$SSL_PATH}cert.config
fi

openssl x509 -req -sha256 -days 365 -in ${SSL_PATH:+$SSL_PATH}cert.csr -signkey ${SSL_PATH:+$SSL_PATH}cert.key -out ${SSL_PATH:+$SSL_PATH}cert.crt
cat ${SSL_PATH:+$SSL_PATH}cert.crt ${SSL_PATH:+$SSL_PATH}cert.key > ${SSL_PATH:+$SSL_PATH}cert.pem