const express = require('express');
const AWS = require('aws-sdk');
const { Amplify, Auth } = require('@aws-amplify/core');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();

Amplify.configure({
  Auth: {
    mandatorySignIn: true,
    region: process.env.AWS_REGION,
    userPoolId: process.env.USER_POOL_ID,
    userPoolWebClientId: process.env.APP_CLIENT_ID,
    identityPoolId: process.env.IDENTITY_POOL_ID
  }
});

const app = express();
app.use(cors());
app.use(express.json());

const dynamodb = new AWS.DynamoDB.DocumentClient();
const APP_USER_TABLE = 'AppUser';
const WORD_TABLE = 'Word';
const LEARN_TABLE = 'Learn';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  try {
    const session = await Auth.currentSession();
    req.userId = session.getIdToken().payload.sub;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Register user
app.post('/register', async (req, res) => {
  const { username, password, email } = req.body;
  try {
    const { user } = await Auth.signUp({
      username,
      password,
      attributes: {
        email
      }
    });
    
    // Add user to AppUser table
    const params = {
      TableName: APP_USER_TABLE,
      Item: {
        userId: user.username,
        email: email
      }
    };
    await dynamodb.put(params).promise();
    
    res.json({ message: 'User registered successfully', userId: user.username });
  } catch (error) {
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
});

// Login user
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await Auth.signIn(username, password);
    const token = user.signInUserSession.idToken.jwtToken;
    res.json({ token, userId: user.username });
  } catch (error) {
    res.status(401).json({ message: 'Error logging in', error: error.message });
  }
});

// Add a new word
app.post('/words', authenticateToken, async (req, res) => {
  const { sourceWord, targetWord } = req.body;
  const wordPairId = Date.now().toString(); // Simple ID generation

  const params = {
    TableName: WORD_TABLE,
    Item: {
      wordPairId: wordPairId,
      sourceWord: sourceWord,
      targetWord: targetWord
    }
  };

  try {
    await dynamodb.put(params).promise();
    res.status(201).json({ wordPairId, sourceWord, targetWord });
  } catch (error) {
    res.status(500).json({ message: 'Error adding word', error: error.message });
  }
});

// Get all words
app.get('/words', async (req, res) => {
  const params = {
    TableName: WORD_TABLE
  };

  try {
    const data = await dynamodb.scan(params).promise();
    res.json(data.Items);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching words', error: error.message });
  }
});

// Add a word to user's learning list
app.post('/learn', authenticateToken, async (req, res) => {
  const { wordPairId } = req.body;

  const params = {
    TableName: LEARN_TABLE,
    Item: {
      userId: req.userId,
      wordPairId: wordPairId
    }
  };

  try {
    await dynamodb.put(params).promise();
    res.status(201).json({ userId: req.userId, wordPairId });
  } catch (error) {
    res.status(500).json({ message: 'Error adding word to learning list', error: error.message });
  }
});

// Get user's learning list
app.get('/learn', authenticateToken, async (req, res) => {
  const params = {
    TableName: LEARN_TABLE,
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': req.userId
    }
  };

  try {
    const data = await dynamodb.query(params).promise();
    
    // Fetch the actual word data for each wordPairId
    const wordPromises = data.Items.map(item => 
      dynamodb.get({
        TableName: WORD_TABLE,
        Key: { wordPairId: item.wordPairId }
      }).promise()
    );
    
    const words = await Promise.all(wordPromises);
    
    res.json(words.map(word => word.Item));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching learning list', error: error.message });
  }
});

// Remove a word from user's learning list
app.delete('/learn/:wordPairId', authenticateToken, async (req, res) => {
  const params = {
    TableName: LEARN_TABLE,
    Key: {
      userId: req.userId,
      wordPairId: req.params.wordPairId
    }
  };

  try {
    await dynamodb.delete(params).promise();
    res.json({ message: 'Word removed from learning list successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error removing word from learning list', error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));