import express from 'express';
import auth from '../../middlewares/auth';
import { ChatController } from './chat.controller';
import { USER_ROLES } from '../../../enums/user';
const router = express.Router();

router.post(
  '/:id',
  auth(USER_ROLES.USER, USER_ROLES.DRIVER, USER_ROLES.SUPER_ADMIN),
  ChatController.createChat
);
router.get(
  '/',
  auth(USER_ROLES.USER),
  ChatController.getChat
);

export const ChatRoutes = router;
