const express = require("express");
const fs = require('fs');
const path = require("path");
const http = require("http");
const cors = require("cors");
require("dotenv").config();
const socketIO = require("socket.io");

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, ""))); //remove it later, I don't need it because app is remote not in same root
const server = http.createServer(app);

const io = socketIO(server,{
    cors: {
        "origin": "*" //["http://localhost:8100", "http://localhost:4200", "http://localhost:1420"]
    }
});

let onlineUsers = [];

io.on("connection", (socket) => {
    
    socket.on('set_username', (username) => {
        if(username){
            socket.username = username;
            console.log(socket.username + ' Online!');
        }
    });
    
    socket.on('join_meeting', (meetingID) => {
       const duplicated = onlineUsers.some(f => f.socketID === socket.id);
       if(!duplicated) {
           let user_data;
           if(meetingID) {
               user_data = {
                   socketID: socket.id,
                   username: socket.username,
                   meetingID: meetingID
               };
               onlineUsers.push(user_data);
           }
           
           if(!socket.meetingID) {
               socket.meetingID = meetingID;
               socket.join(socket.meetingID);
           }

           socket.emit('update_users', {
               onlineUsers: onlineUsers.filter(f => f.socketID !== socket.id && f.meetingID === socket.meetingID),
               my_info: user_data
           });

           socket.to(socket.meetingID).emit('update_users', {
               onlineUsers: [user_data]
           });

           console.log(socket.username, ' joined ', socket.meetingID, ' meeting');
       }
    });
    
    socket.on('SDPProcess', (res) => {
       socket.to(socket.meetingID).emit('SDPProcess', {
           message: res.message,
           from_socket: socket.id
       }) ;
    });
    
    socket.on('leave_meeting', (meetingID) => {
        const user = onlineUsers.find(f => f.socketID === socket.id);
        socket.to(socket.meetingID).emit('disconnected_user', user);
        socket.leave(socket.meetingID);
        console.log(socket.username, ' left ', socket.meetingID, ' meeting');
    });

    socket.on('disconnect', () => {
        const disconnected = onlineUsers.find(f => f.socketID === socket.id);
        if(disconnected) {
            const index = onlineUsers.indexOf(disconnected);
            if(index !== -1) {
                onlineUsers.splice(index, 1);
            }
            if(socket.meetingID) {
                socket.to(socket.meetingID).emit('disconnected_user', disconnected);
                socket.leave(socket.meetingID);
            }else{
                socket.broadcast.emit('disconnected_user', disconnected);
            }
            console.log(socket.username, " offline!");
        }
    });
});

const port = process.env.API_PORT || process.env.PORT;
server.listen(port, () => {
    console.log(`Listening to: http://localhost:${port}`);
})