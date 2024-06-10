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