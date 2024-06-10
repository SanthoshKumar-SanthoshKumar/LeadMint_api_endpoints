const express = require('express')
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const port = process.env.PORT || 3000 ;
const app = express()
const jwt_secreate = "Your Secreate Key"

const db = new sqlite3.Database('chatroom.db',(error)=>{
    if(error){
        return console.log(`could not oopen database:`,error.message)
    }
    console.log(`connected To ChatRoom Database`)
})

// middleware 
app.use(express.json()) 

db.serialize(()=>{

    // CREATE users tables 
    db.run(`CREATE TABLE IF NOT EXISTS users(
        userId TEXT PRIMARY KEY,
        deviceId TEXT,
        name TEXT,
        phone TEXT,
        availCoins INTEGER,
        isPrime BOOLEAN,
        password TEXT

    )`,(err)=>{
        if (err){
            return console.log('Error Creating users Table:',err.message)
        }
        console.log('Users Table Created Successfully')
    })
    
    //CREATE chatroom tables
    db.run(`CREATE TABLE IF NOT EXISTS chatrooms(
        roomId TEXT PRIMARY KEY,
        creatorId TEXT ,
        roomPassword TEXT,
        maxCapacity INTEGER DEFAULT 6,
        participants INTEGER DEFAULT 0,
        FOREIGN KEY (creatorId) REFERENCES users(userId)
    )`,(err)=>{
        if (err){
            return console.log('Error Creating Chatrooms Table:',err.message)
        }
        console.log('Chatrooms Table Created Successfully')
    }
)

    // create messages table
    db.run(`CREATE TABLE IF NOT EXISTS messages(
        messageId INTEGER PRIMARY KEY AUTOINCREMENT,
        roomId TEXT,
        userId TEXT,
        message TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(userId),
        FOREIGN KEY (roomId) REFERENCES chatrooms(roomId)
    )`,(err)=>{
        if (err){
            return console.log('Error Creating Messages Table:',err.message)
        }
        console.log('Messages Table Created Successfully')
    })

    // create friendRequest tables 
    db.run(`
     CREATE TABLE IF NOT EXISTS friendRequests(
        requestId INTEGER PRIMARY KEY AUTOINCREMENT,
        fromUserId TEXT,
        toUserId TEXT,
        status TEXT,
        FOREIGN KEY (fromUserId) REFERENCES users(userId),
        FOREIGN KEY (toUserId) REFERENCES users(userId)
     )`,(err)=>{
        if (err){
            return console.log('Error Creating friendRequests Table:',err.message)
        }
        console.log('friendRequests Table Created Successfully')
    })

    // create room Participants and staus table 
    db.run(`CREATE TABLE IF NOT EXISTS room_participants (
        roomId TEXT,
        userId TEXT,
        isFree BOOLEAN DEFAULT 0,
        FOREIGN KEY (roomId) REFERENCES chatrooms(roomId),
        FOREIGN KEY (userId) REFERENCES users(userId),
        PRIMARY KEY (roomId,userId)
        )`,(err)=>{
            if (err){
                return console.log('Error Creating FriendRequests Table:',err.message)
            }
            console.log('FriendRequests Table Created Successfully')
    })
})


// jwtToken middle ware 
const authenticateJwt = (req,res,next)=>{
    const token = req.headers.authorization?.split(' ')[1]

    if (!token){
        return res.status(400).json({error:'Unauthorized'})
    }

    jwt.verify(token,jwt_secreate,(err,user)=>{
        if(err){
            return res.status(403).json({Error:'Invalid User'})
        }

        req.user = user 
        next()
    })
}

// User registers API
app.post('/register' ,(req,res)=>{
    const {userId,deviceId,name,phone,availCoins,password} = req.body 

    // check if all require fileds are provided 
    if (!userId || !deviceId || !name || !phone || !availCoins || !password){
        return res.status(400).json({error:'All Fields Are Required'})
    }

    // check if the user already exists or not 

    db.get(`SELECT * FROM users WHERE userId=?`,[userId],(err,row)=>{
        if(err){
            console.log('Error Querying the database:',err.message)
            return res.status(500).json({Error:'Database Error'})
        }
        if(row){
            return res.status(400).json('User already exists')
        }
    })

    //hash the password 
    const hashedPassword = bcrypt.hash(password,10) ;

    db.run(`
        INSERT INTO users(userId,deviceId,name,phone,availCoins,isPrime,password) VALUES(?,?,?,?,?,?,?) 
    `,[userId,deviceId,name,phone,availCoins,false,hashedPassword],(err)=>{
        if(err){
            return res.status(400).json({error:err.message})
        }
        const token = jwt.sign({userId,isPrime:false},jwt_secreate)
        res.status(200).json({token})
    })
})

// user login API
app.post('/login',(req,res)=>{
    const {userId,password} = req.body 

    // check if all the fileds are provided 

    if(!userId || !password){
        return res.status(400).json({Error:'All fields are required'})
    }
    // fetch user from database
    db.get(`SELECT * FROM users WHERE userId=?`,[userId],(err,user)=>{
        if(err || !user){
            return res.status(400).json('User not found')
        }

         // check if password is correct 
         if(!bcrypt.compare(password, user.password)){
            return res.status(400).json('Invalid Password')
         }

         const token = jwt.sign({userId:user.userId,isPrime:user.isPrime},jwt_secreate)
         res.json({token})
    })

   
})

// Room creation API
app.post('/chatrooms', authenticateJwt ,(req,res)=>{
    const {roomId,roomPassword} = req.body 
    const creatorId = req.user.userId ;

    // check if all reqired feilds are provided

    if(!roomId || !roomPassword){
        return res.status(400).json({Error:'All Fields are required'})
    }

   // check if the chat room is already created 

   db.get(`
     SELECT * FROM chatrooms WHERE roomId=?
   `,[roomId],(err,row)=>{
    if(err){
        console.log(`Error Querying the database`,err.message)
        return res.status(500).json({error: 'Database Error'})
    }
    if(row){
        res.status(400).json({Error:'Chat Room Already exists'})
    }
   })

   // insert the new Room into database
   db.run(`
     INSERT INTO chatrooms(roomId,creatorId,roomPassword) VALUES(?,?,?)
   `,[roomId,creatorId,roomPassword],(err)=>{
    if(err){
        console.log('Error inserting room into databases',err.message)
        return res.status(400).json({Error:err.message})
    }
    res.status(201).json({message:'Chatroom created Succesfully'})
   })
})

//API for room creators to invite prime members using a secure token.
app.post('/chatrooms/invite',authenticateJwt,(req,res)=>{
    const {roomId,inviteeId} = req.body;
    const inviterId= req.user.userId;

    // check if all the require fields are provided 
    if(!roomId || inviteeId){
        return res.status(400).json({Error:'All fields are required'})
    }
    //check if the invitee is the creator of room 

    db.get(`SELECT * FROM chatrooms WHERE roomId=? AND creatorId=?`,[roomId,inviterId],(err,room)=>{
        if(err){
            console.log(`Error Querying the database:`,err.message)
            return res.status(500).json({Error:'Database error'})
        }

        if(!room){
            return res.status(403).json({error:'Only room creators can invite participants'})
        }
    })
    // chaeck if the invitee is prime 
    db.run(`SELECT * FROM users WHERE userId=?`,[userId],(err,invitee)=>{
        if(err){
            console.log(`Error Querying the database:`,err.message)
            return res.status(500).json({Error:'Database error'})
        }

        if(!invitee){
           return res.status(404).json({error:'Invitee not found'})
        }

        if(!invitee.isPrime){
            return res.status(403).json({error:'Invitee Must Be Prime Memeber'})
        }

        const inviteeToken = jwt.sign({roomId,inviteeId},jwt_secreate,{expiresIn:'1h'})

        res.status(200).json({inviteeToken})
    })
})

// API for non-prime members to join rooms 
//they have to pay 150 coins after their first free room
app.post('/chatrooms/joinroom',authenticateJwt,(req,res)=>{
   const {roomId,roomPassword} = req.body ;
   const userId = req.user.userId;

   //check all fields are provided 
   if(!roomId || !roomPassword){
     return res.status(400).json({error:'All fields are required'})
   }

   //check if room exists and password is correct 
db.all(`select  COUNT(*) AS participants FROM room_participants WHERE roomId='?`,[roomId],(er,result)=>{
    if(err){
        console.log('Error Querying the database:',err.message)
        return res.status(500).json({error:'Database Error'})
    }

    if(result[0].participants>=6){
        return res.status(403).json({Error:'Room is Full'})
    }
    
    // check if the user already participated in the room 
    db.get(`SELECT * FROM chatrooms WHERE rooId=? AND roomPassword=?`,[roomId,roomPassword],(err)=>{
        if(err){
            console.log('Error Querying the database:',err.message)
            return res.status(500).json({error:'Database Error'})
        }
        
       // check if the user is already participant in room 
        db.get(`SELECT * FROM room_participants WHERE roomId=? AND userId=?`,[roomId,userId],(err,participant)=>{
            if(err){
                console.log('Error querying with database:',err.message)
                return res.status(400).json({error:'Database error'})
            }
            if(participant){
                return res.status(500).json({error:'User already in the room'})
            }
    
            // check if user is prime member or has alredy Joioned a room for free 
    
            db.get(`SELECT * FROM room_participants WHERE roomId=? AND isfree=1`,[userId],(err,freeRoom)=>{
                if(err){
                    console.log('Error Querying with Database',err.message)
                    return res.status(400).json({error:'database error'})
                }
    
                if(freeRoom){
                    // check user  has already joined room for free 
                    db.get(`SELECT availCoins from users WHERE userId=?`,[userId],(err,user)=>{
                        if(err){
                            console.log('Error Querying with database',err.message)
                            return res.status(400).json({error:"Database Error"})
                        }
    
                        if(user.availCoins<150){
                           return res.status(403).json({error:'Insufficient coins'})
                        }
                        //Deduct the coins from user's Account 
    
                        db.run(`UPDATE users SET availCoins=availCoins-150 WHERE userId=?`,[userId],(err)=>{
                            if (err){
                                console.log("Error Updating Users coins:",err.message)
                                return res.status(500).json({error:'Error Updating Coins'})
                            }
                            // Add the User into the room
                            db.run(`INSERT INTO room_participants(userId,roomId) VALUES(?,?)`,[userId,roomId],(err)=>{
                                if(err){
                                    console.log('Error in Inserting the participans into the room')
                                    return res.status(500).json({error:'Database Error'})
                                }
    
                                //In crement the participants Count in to the room 
                                db.run(`UPDATE chatrooms SET participants=participants+1 WHERE userId=?`,[userId],(err)=>{
                                    if(err){
                                        console.log('Error Updating participants in to chatrooms',err.message)
                                        return res.status(500).json({error:'Database Error'})
                                    }
    
                                    res.status(200).json({message:'Joined room Successfully'})
                                })
                            })
                        })
                    })
                }else{
                    // User is Joining a roomfor the first time 
                db.run(`INSERT INTO room_participants(userId,roomId) VALUES(?,?)`,[userId,roomId],(err)=>{
                    if(err){
                    console.log('Error in Inserting a participant into room')
                    return res.status(500).json({error:'Database Error'})
                }
    
                // Increament the participants count in the chatrooms 
                db.run(`UPDATE chatrooms SET participants=participants+1 WHERE userId=?`,[userId],(err)=>{
                    if(err){
                        console.log('Error Updating particiapnt into the room')
                        return res.status(500).json({Error:'Database Error'})
                    }
                    res.status(200).json({Message:"Joined room Successfully"})
                })
                })
            }
        })     
       })
    })
})
 
})


// API for Profile Viewing 

app.get('/profile/:userId',(req,res)=>{
    const userId = req.params.userId 

    // check all the fields are Provided 
    if(!userId){
         return res.status(400).json({Error:'UserId is required'})
    }
    // Query the database to get the user details 
    db.get(`SELECT userid,deviceId,name,phone,availCoins,isPrime FROM users WHERE userId=?`,[userId],(err,user)=>{
        if(err){
            console.log("Error Querying the Database:",err.message)
            return res.status(500).json({Error:'Database Error'})
        }
        if(!user){
            return res.status(404).json({error:'User not found'})
        }

        res.status(200).json({
            userId:user.userId,
            deviceId:user.deviceId,
            name:user.name,
            phone:user.phone,
            availCoins:user.availCoins,
            isPrime:user.isPrime

        })
    })
})

//API for Friend Requests 

app.get('/friend-requests',(req,res)=>{
    const {toUserId} = req.body;
    const fromUserId = req.user.userId;

    // check all fields are Provided 
    if (!toUserId){
        return res.status(400).json({error:'Reciver Id required'})
    }

    // check if the friend request is already requested 

    db.get(`SELECT * FROM user WHERE userId=?`,[fromUserId],(err,reciever)=>{
        if(err){
            console.log("Error Querying with database:",err.message)
            return res.status(500).json({error:'Database error'})
        }

        if(!reciever){
            return res.status(404).json({error:"Reciever not found"})
        }

        // check friend request is already exists 

        db.get(`SELECT * FROM friendRequests WHERE toUserId=? AND fromUserId=? AND status="pending"`,[toUserId,fromUserId],(err,friendRequests)=>{
            if(err){
                console.log('Error Querying with database:',err.message)
                return res.status(500).json({error:'Database error'})
            }

            if(friendRequests){
                return res.status(400).json({error:'Friend request is already exists'})
            }

            // INSERTing REQUESTS INTO DATABASE 

            db.run(`INSERT INTO friendRequests(toUserId,fromUserId,status) VALUES(?,?,pending)`,[toUserId,fromUserId],(err)=>{
                if(err){
                    console.log('Error inserting friend Requests into Database:',err.message)
                    return res.status(500).json({Error:'Database error'})
                }

                res.status(200).json({Message:'Friend request sent Successfully'})
            })
        })
    })
})


app.listen(port , ()=>{
    console.log(`Server Running At http:localhost/${port}`)
})

