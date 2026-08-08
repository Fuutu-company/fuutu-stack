import { getCurrentUser } from "./procedures/get-current-user";
import { updateUserProfile } from "./procedures/update-user-profile";

export const usersRouter = {
	me: getCurrentUser,
	updateProfile: updateUserProfile,
};
