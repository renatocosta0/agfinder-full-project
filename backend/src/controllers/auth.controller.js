const jwt = require('jsonwebtoken');
const { User, BonusTransaction } = require('../models');
const logger = require('../utils/logger');
const crypto = require('crypto');

// Função para gerar hash de senha com salt
const generateHash = (password, salt) => {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex');
  }

  // Usa PBKDF2 para gerar um hash seguro
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');

  return { hash, salt };
};

// Registrar novo usuário com email e senha
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validação dos campos
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Todos os campos são obrigatórios',
      });
    }

    // Validação de senha
    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'A senha deve ter pelo menos 6 caracteres',
      });
    }

    // Verificar se o usuário já existe
    const existingUser = await User.findOne({ where: { email } });

    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        message: 'Este email já está sendo usado por outra conta',
      });
    }

    // Gerar hash e salt para a senha
    const { hash, salt } = generateHash(password);

    // Criar o usuário
    const user = await User.create({
      name,
      email,
      password_hash: hash,
      salt,
      bonus_points: 0,
    });

    // Gerar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    logger.info(`Novo usuário registrado: ${email}`);

    // Retornar resposta
    return res.status(201).json({
      status: 'success',
      message: 'Usuário registrado com sucesso',
      token,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.has_active_subscription ? 'active' : 'none',
          subscription_end: user.current_subscription_end,
          is_banned: user.is_banned,
        },
      },
    });
  } catch (error) {
    logger.error('Erro ao registrar usuário:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao registrar usuário',
    });
  }
};

// Login com email e senha
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação dos campos
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Email e senha são obrigatórios',
      });
    }

    // Buscar usuário pelo email
    const user = await User.findOne({ where: { email } });

    // Verificar se o usuário existe
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Email ou senha incorretos',
      });
    }

    // Verificar se o usuário tem senha (contas antigas criadas via OAuth podem não ter)
    if (!user.password_hash || !user.salt) {
      return res.status(401).json({
        status: 'error',
        message: 'Esta conta não possui senha definida. Redefina/defina uma senha para continuar.',
      });
    }

    // Verificar se o usuário está banido
    if (user.is_banned) {
      // Verificar se o banimento expirou
      if (user.ban_expiry && new Date() > user.ban_expiry) {
        // Remove o banimento do usuário
        user.is_banned = false;
        user.ban_reason = null;
        user.ban_expiry = null;
        await user.save();
      } else {
        return res.status(403).json({
          status: 'error',
          message: 'Sua conta foi suspensa',
          reason: user.ban_reason,
          expiry: user.ban_expiry,
        });
      }
    }

    // Verificar a senha
    const { hash } = generateHash(password, user.salt);

    if (hash !== user.password_hash) {
      return res.status(401).json({
        status: 'error',
        message: 'Email ou senha incorretos',
      });
    }

    // Gerar JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    logger.info(`Usuário logado: ${email}`);

    // Retornar resposta
    return res.status(200).json({
      status: 'success',
      message: 'Login realizado com sucesso',
      token,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.has_active_subscription ? 'active' : 'none',
          subscription_end: user.current_subscription_end,
          is_banned: user.is_banned,
        },
      },
    });
  } catch (error) {
    logger.error('Erro ao fazer login:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Erro ao fazer login',
    });
  }
};



// Get current user info
const getCurrentUser = async (req, res) => {
  try {
    const { user } = req;

    return res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.has_active_subscription ? 'active' : 'none',
          subscription_end: user.current_subscription_end,
          is_banned: user.is_banned,
        },
      },
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Error fetching user information',
    });
  }
};

// Firebase Auth - get or create JWT para uso interno
const firebaseAuth = async (req, res) => {
  try {
    // O middleware de autenticação Firebase já verificou o token e adicionou o usuário à requisição
    const { user } = req;

    logger.info(`Firebase auth - Usuário autenticado: ${JSON.stringify(user)}`);

    if (!user) {
      logger.error('Firebase auth - Usuário não encontrado na requisição');
      return res.status(401).json({
        status: 'error',
        message: 'User not found in request',
      });
    }

    // Gera um JWT para uso interno (opcional, mas útil para compatibilidade com sistemas existentes)
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    logger.info(`Firebase auth - JWT gerado com sucesso para usuário ${user.email}`);

    const response = {
      status: 'success',
      message: 'Firebase authentication successful',
      token: jwtToken,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          profile_picture: user.profile_picture,
          bonus_points: user.bonus_points,
          subscription_type: user.subscription_type,
          subscription_end: user.subscription_end,
          is_banned: user.is_banned,
        },
      },
    };

    logger.info(`Firebase auth - Resposta preparada: ${JSON.stringify(response)}`);

    return res.status(200).json(response);
  } catch (error) {
    logger.error('Firebase auth error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication failed',
    });
  }
};

/**
 * Bootstrap admin user using a one-time setup token
 * - Requires header: X-Setup-Token: process.env.SETUP_ADMIN_TOKEN
 * - Body: { name, email, password }
 * - If user exists, promotes to admin (and updates password if provided)
 * - If not, creates admin user
 */
async function bootstrapAdmin(req, res) {
  try {
    const setupToken = req.headers['x-setup-token'] || req.headers['X-Setup-Token'];
    if (!process.env.SETUP_ADMIN_TOKEN || setupToken !== process.env.SETUP_ADMIN_TOKEN) {
      return res.status(403).json({ status: 'error', message: 'Invalid setup token' });
    }

    const { name, email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'email and password are required' });
    }

    let user = await User.findOne({ where: { email } });

    if (user) {
      // Promote existing user
      const { hash, salt } = generateHash(password);
      user.password_hash = hash;
      user.salt = salt;
      user.is_admin = true;
      if (name) user.name = name;
      await user.save();
    } else {
      // Create new admin user
      const { hash, salt } = generateHash(password);
      user = await User.create({
        name: name || email.split('@')[0],
        email,
        password_hash: hash,
        salt,
        bonus_points: 0,
        subscription_type: 'none',
        is_admin: true,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Admin account ready',
      token,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          is_admin: user.is_admin,
        }
      }
    });
  } catch (error) {
    logger.error('Erro ao bootstrap admin:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to bootstrap admin' });
  }
}

module.exports = {
  getCurrentUser,
  register,
  login,
  bootstrapAdmin,
};