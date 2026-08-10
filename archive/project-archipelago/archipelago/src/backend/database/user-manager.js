//=============================================
// ARCHIPELAGO USER MANAGEMENT SYSTEM
//=============================================
// Complete user lifecycle management with authentication, encryption, and security
// Based on Oracle Autonomous JSON Database

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sodaManager } = require('./soda-manager');
const { connectionManager } = require('./oracle-config');

class UserManager {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'archipelago-jwt-secret-key-404';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;

    // Subscription tiers with pricing
    this.subscriptionTiers = {
      discovery: { price: 50, islands: 1, name: 'Discovery' },
      stewardship: { price: 100, islands: 2, name: 'Stewardship' },
      legacy: { price: 200, islands: 3, name: 'Legacy' }
    };
  }

  // Validate user registration data
  validateUserData(userData) {
    const errors = [];

    if (!userData.email || !userData.email.includes('@')) {
      errors.push('Valid email address is required');
    }

    if (!userData.password || userData.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!userData.wallet_address) {
      errors.push('Wallet address is required');
    }

    if (userData.subscription_tier && !this.subscriptionTiers[userData.subscription_tier]) {
      errors.push('Invalid subscription tier');
    }

    return errors;
  }

  // Create new user account with encrypted password
  async createUser(userData) {
    try {
      console.log(`👤 Creating user account for: ${userData.email}`);

      // Validate input data
      const validationErrors = this.validateUserData(userData);
      if (validationErrors.length > 0) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Check if user already exists
      const existingUser = await this.getUserByEmail(userData.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, this.bcryptRounds);

      // Create user document
      const userDocument = {
        _id: crypto.randomUUID(),
        email: userData.email,
        encrypted_password: hashedPassword,
        wallet_address: userData.wallet_address,
        subscription_tier: userData.subscription_tier || 'discovery',
        islands_owned: [],
        total_spent: 0.00,
        created_at: new Date().toISOString(),
        last_login: null,
        preferences: {
          email_notifications: true,
          event_alerts: true,
          social_sharing: true
        },
        payment_methods: [],
        auth_tokens: [],
        security: {
          failed_login_attempts: 0,
          locked_until: null,
          password_reset_token: null,
          token_expires_at: null
        }
      };

      // Insert into database
      await sodaManager.insertDocument('users', userDocument);

      // Remove sensitive data before returning
      const safeUser = { ...userDocument };
      delete safeUser.encrypted_password;
      delete safeUser.auth_tokens;
      delete safeUser.security;

      console.log(`✅ User account created: ${userData.email}`);
      return safeUser;
    } catch (error) {
      console.error(`❌ Failed to create user:`, error.message);
      throw error;
    }
  }

  // Authenticate user and return JWT token
  async authenticateUser(email, password) {
    try {
      console.log(`🔐 Authenticating user: ${email}`);

      const user = await this.getUserByEmail(email, true); // Include sensitive data
      if (!user) {
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.security?.locked_until && new Date() < new Date(user.security.locked_until)) {
        throw new Error('Account temporarily locked due to failed login attempts');
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.encrypted_password);
      if (!passwordValid) {
        await this.handleFailedLogin(user._id);
        throw new Error('Invalid email or password');
      }

      // Reset failed login attempts on successful authentication
      await this.resetFailedLoginAttempts(user._id);

      // Update last login
      await this.updateLastLogin(user._id);

      // Generate JWT token
      const token = jwt.sign(
        {
          userId: user._id,
          email: user.email,
          tier: user.subscription_tier,
          iat: Math.floor(Date.now() / 1000)
        },
        this.jwtSecret,
        { expiresIn: this.jwtExpiresIn }
      );

      // Store auth token in user document
      await this.storeAuthToken(user._id, token);

      console.log(`✅ User authenticated: ${email}`);

      return {
        token,
        user: {
          id: user._id,
          email: user.email,
          tier: user.subscription_tier,
          wallet_address: user.wallet_address,
          islands_owned: user.islands_owned.length
        }
      };
    } catch (error) {
      console.error(`❌ Authentication failed:`, error.message);
      throw error;
    }
  }

  // Verify JWT token and return user data
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);

      // Check if token is still valid in database
      const isValid = await this.validateAuthToken(decoded.userId, token);
      if (!isValid) {
        throw new Error('Token has been invalidated');
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        tier: decoded.tier,
        valid: true
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Get user by email (internal method, can include sensitive data)
  async getUserByEmail(email, includeSensitive = false) {
    try {
      const users = await sodaManager.find('users', { email });

      if (users.length === 0) {
        return null;
      }

      const user = users[0];

      if (!includeSensitive) {
        // Remove sensitive data
        delete user.encrypted_password;
        delete user.auth_tokens;
        delete user.security;
      }

      return user;
    } catch (error) {
      console.error(`❌ Failed to get user by email:`, error.message);
      return null;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    try {
      const user = await sodaManager.findById('users', userId);

      if (!user) {
        return null;
      }

      // Remove sensitive data
      delete user.encrypted_password;
      delete user.auth_tokens;
      delete user.security;

      return user;
    } catch (error) {
      console.error(`❌ Failed to get user by ID:`, error.message);
      return null;
    }
  }

  // Update user profile
  async updateUserProfile(userId, updateData) {
    try {
      console.log(`📝 Updating user profile: ${userId}`);

      // Validate update data
      const allowedFields = ['email', 'wallet_address', 'preferences'];
      const sanitizedData = {};

      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          sanitizedData[field] = updateData[field];
        }
      }

      sanitizedData.updated_at = new Date().toISOString();

      await sodaManager.updateById('users', userId, sanitizedData);

      console.log(`✅ User profile updated: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to update user profile:`, error.message);
      throw error;
    }
  }

  // Change user password
  async changePassword(userId, currentPassword, newPassword) {
    try {
      console.log(`🔑 Changing password for user: ${userId}`);

      const user = await sodaManager.findById('users', userId, true);
      if (!user) {
        throw new Error('User not found');
      }

      // Verify current password
      const currentValid = await bcrypt.compare(currentPassword, user.encrypted_password);
      if (!currentValid) {
        throw new Error('Current password is incorrect');
      }

      // Validate new password
      if (newPassword.length < 8) {
        throw new Error('New password must be at least 8 characters long');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, this.bcryptRounds);

      // Update password and reset failed attempts
      await sodaManager.updateById('users', userId, {
        encrypted_password: hashedPassword,
        'security.failed_login_attempts': 0,
        'security.locked_until': null,
        password_changed_at: new Date().toISOString()
      });

      // Invalidate all auth tokens for security
      await this.invalidateAllAuthTokens(userId);

      console.log(`✅ Password changed for user: ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to change password:`, error.message);
      throw error;
    }
  }

  // User management methods

  // Handle failed login attempt
  async handleFailedLogin(userId) {
    try {
      const connection = await connectionManager.getConnection();

      // Get current failed attempts
      const user = await sodaManager.findById('users', userId);
      if (!user) return;

      const failedAttempts = (user.security?.failed_login_attempts || 0) + 1;
      let lockedUntil = null;

      // Lock account after 5 failed attempts
      if (failedAttempts >= 5) {
        lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes
        console.log(`🚫 Account locked due to failed attempts: ${userId}`);
      }

      await sodaManager.updateById('users', userId, {
        'security.failed_login_attempts': failedAttempts,
        'security.locked_until': lockedUntil
      });

      await connection.close();
    } catch (error) {
      console.error(`❌ Failed to handle failed login:`, error.message);
    }
  }

  // Reset failed login attempts after successful authentication
  async resetFailedLoginAttempts(userId) {
    try {
      await sodaManager.updateById('users', userId, {
        'security.failed_login_attempts': 0,
        'security.locked_until': null
      });
    } catch (error) {
      console.error(`❌ Failed to reset failed login attempts:`, error.message);
    }
  }

  // Update last login timestamp
  async updateLastLogin(userId) {
    try {
      await sodaManager.updateById('users', userId, {
        last_login: new Date().toISOString()
      });
    } catch (error) {
      console.error(`❌ Failed to update last login:`, error.message);
    }
  }

  // Store authentication token
  async storeAuthToken(userId, token) {
    try {
      await sodaManager.updateById('users', userId, {
        auth_tokens: new Date().toISOString() // Simplified for demo
      });
    } catch (error) {
      console.error(`❌ Failed to store auth token:`, error.message);
    }
  }

  // Validate authentication token
  async validateAuthToken(userId, token) {
    try {
      // For production, implement proper token validation/storage
      return true; // Simplified for demo
    } catch (error) {
      return false;
    }
  }

  // Invalidate all auth tokens for a user
  async invalidateAllAuthTokens(userId) {
    try {
      await sodaManager.updateById('users', userId, {
        'auth_tokens': []
      });
    } catch (error) {
      console.error(`❌ Failed to invalidate auth tokens:`, error.message);
    }
  }

  // Add island to user's owned islands list
  async addIslandToUser(userId, islandId) {
    try {
      console.log(`🏝️ Adding island ${islandId} to user ${userId}`);

      const user = await sodaManager.findById('users', userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.islands_owned.includes(islandId)) {
        throw new Error('User already owns this island');
      }

      // Check subscription tier limits
      const tierLimits = this.subscriptionTiers[user.subscription_tier || 'discovery'];
      if (user.islands_owned.length >= tierLimits.islands) {
        throw new Error(`Subscription tier '${user.subscription_tier}' allows maximum ${tierLimits.islands} islands`);
      }

      await sodaManager.updateById('users', userId, {
        islands_owned: [...user.islands_owned, islandId]
      });

      console.log(`✅ Island ${islandId} added to user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to add island to user:`, error.message);
      throw error;
    }
  }

  // Remove island from user's owned islands list
  async removeIslandFromUser(userId, islandId) {
    try {
      console.log(`🗑️ Removing island ${islandId} from user ${userId}`);

      const user = await sodaManager.findById('users', userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.islands_owned.includes(islandId)) {
        throw new Error('User does not own this island');
      }

      await sodaManager.updateById('users', userId, {
        islands_owned: user.islands_owned.filter(id => id !== islandId)
      });

      console.log(`✅ Island ${islandId} removed from user ${userId}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Failed to remove island from user:`, error.message);
      throw error;
    }
  }

  // Update user's total spending
  async updateUserSpending(userId, amount, operation = 'add') {
    try {
      const user = await sodaManager.findById('users', userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentSpent = user.total_spent || 0;
      const newAmount = operation === 'add' ? currentSpent + amount : currentSpent - amount;

      await sodaManager.updateById('users', userId, {
        total_spent: Math.max(0, newAmount) // Prevent negative values
      });

      return { success: true, newTotal: newAmount };
    } catch (error) {
      console.error(`❌ Failed to update user spending:`, error.message);
      throw error;
    }
  }

  // Upgrade user's subscription tier
  async upgradeUserTier(userId, newTier) {
    try {
      console.log(`⬆️ Upgrading user ${userId} to ${newTier}`);

      if (!this.subscriptionTiers[newTier]) {
        throw new Error('Invalid subscription tier');
      }

      const user = await sodaManager.findById('users', userId);
      if (!user) {
        throw new Error('User not found');
      }

      const currentTier = user.subscription_tier;
      if (currentTier === newTier) {
        throw new Error('User is already on this tier');
      }

      // Calculate tier upgrade cost
      const currentTierPrice = this.subscriptionTiers[currentTier].price;
      const newTierPrice = this.subscriptionTiers[newTier].price;
      const upgradeCost = newTierPrice - currentTierPrice;

      await sodaManager.updateById('users', userId, {
        subscription_tier: newTier,
        total_spent: (user.total_spent || 0) + upgradeCost
      });

      console.log(`✅ User ${userId} upgraded to ${newTier}`);
      return {
        success: true,
        upgradeCost,
        newTier,
        additionalIslands: this.subscriptionTiers[newTier].islands - this.subscriptionTiers[currentTier].islands
      };
    } catch (error) {
      console.error(`❌ Failed to upgrade user tier:`, error.message);
      throw error;
    }
  }

  // Get user statistics for dashboard
  async getUserStats() {
    try {
      const totalUsers = await sodaManager.count('users');
      const tierStats = {};

      for (const [tier, details] of Object.entries(this.subscriptionTiers)) {
        const tierCount = await sodaManager.count('users', { subscription_tier: tier });
        const tierRevenue = tierCount * details.price;
        tierStats[tier] = { users: tierCount, revenue: tierRevenue };
      }

      return {
        totalUsers,
        tierBreakdown: tierStats,
        totalRevenue: Object.values(tierStats).reduce((sum, tier) => sum + tier.revenue, 0)
      };
    } catch (error) {
      console.error(`❌ Failed to get user stats:`, error.message);
      throw error;
    }
  }
}

//=============================================
// GLOBAL USER MANAGER INSTANCE
//=============================================
const userManager = new UserManager();

//=============================================
// MODULE EXPORTS
//=============================================
module.exports = {
  UserManager,
  userManager
};