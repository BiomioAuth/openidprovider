FROM       ubuntu:14.04

RUN apt-get update && apt-get install -y curl \
    git \
    python \
    python-dev \
    python-setuptools \
    build-essential \
    g++

RUN curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -
RUN sudo apt-get install -y nodejs

#install supervisor for ENTRYPOINT record
#
#RUN apt-get update && apt-get install -y supervisor
#RUN mkdir /var/log/supervisord/
#RUN touch /var/log/supervisord/supervisord.log

RUN mkdir /root/.ssh

#BIOMIO openidprovider get code
#
#git access ssh key
#
COPY id_rsa /root/.ssh/id_rsa

#set gut url and branch/tag
#
ENV GITBRANCH master
ENV GITURL "git@bitbucket.org:biomio/openidprovider.git"

#disable caching
#
ARG CACHE_DATE=2016-01-01

RUN ssh-keyscan bitbucket.org >> ~/.ssh/known_hosts

#disable caching
#
ARG CACHE_DATE=2016-01-01

RUN cd /opt/ && git clone -b $GITBRANCH $GITURL

RUN cd /opt/openidprovider && npm install "git+ssh://git@bitbucket.org:biomio/biomio-node.git#0.0.6" --save

RUN cd /opt/openidprovider && npm install

RUN cd /opt/openidprovider && npm i -g bower

RUN cd /opt/openidprovider && bower install --allow-root

#RUN cd /opt/openidprovider && npm install pm2 -g


#COPY process.yml /opt/openidprovider/process.yml
#COPY supervisord.conf /opt/supervisord.conf
