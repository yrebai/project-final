import axios from "axios";

import {
	PUSH_SUCCESS,
	PUSH_ERROR,
	PULL_SUCCESS,
	LOGIN_SUCCESS,
	LOGIN_ERROR,
	LOGOUT,
	START_LOADING,
	STOP_LOADING,
	CLEAR_MESSAGES,
} from "./actionTypes";

/**
 * Something is currently loading in the App (login, syncing data)
 */
export const startLoading = () => {
	return {
		type: START_LOADING,
	};
};

/**
 * We don't have any more loading
 */
export const stopLoading = () => {
	return {
		type: STOP_LOADING,
	};
};

/**
 * Try to login: launch the AJAX request and analyze the response
 * @param {string} login
 * @param {string} password
 */
export const login = (email, password) => {
	return (dispatch, getState) => {
		dispatch(startLoading());

		axios
			.post(
				"https://beerkip.mosaika.fr/wp-json/jwt-auth/v1/token",
				{
					username: email,
					password: password,
				},
				{
					timeout: 10000,
				}
			)
			.then(response => {
				dispatch(stopLoading());

				if (response.status === 200) {
					dispatch(
						loginSuccess({
							token: response.data.token,
							id: response.data.user_id,
							login: response.data.user_login,
							email: response.data.user_email,
							name: response.data.user_display_name,
						})
					);
				} else {
					dispatch(loginError("Something went wrong."));
				}
			})
			.catch(error => {
				dispatch(stopLoading());

				if (
					error.response &&
					error.response.status &&
					error.response.status == 403
				) {
					dispatch(
						loginError(
							"This e-mail/password combination is incorrect."
						)
					);
				} else {
					dispatch(loginError("Something went wrong."));
				}
			});
	};
};

/**
 * When login is successful, save user data/token
 * @param {object} data The user data coming from WP
 */
export const loginSuccess = data => {
	return {
		type: LOGIN_SUCCESS,
		data,
	};
};

/**
 * When login failed
 */
export const loginError = message => {
	return {
		type: LOGIN_ERROR,
		message,
	};
};

/**
 * Logging out
 */
export const logout = () => {
	return {
		type: LOGOUT,
	};
};

/**
 * Clear UI (error) messages, so that we don't display them forever
 */
export const clearMessages = () => {
	return {
		type: CLEAR_MESSAGES,
	};
};

/**
 * Launch our Push action, to synchronize data with our WordPress back-end.
 */
export const push = () => {
	return async (dispatch, getState) => {
		dispatch(startLoading());

		try {
			const token = getState().app.user.token;

			/**
			 * Get "fresh" beers (that were created/edited/deleted)
			 */
			const beers = getState().beers.filter(beer => beer && beer.edited);
			// const photos = getState().photos.filter(photo => photo.edited);

			if (beers.length > 0) {
				/**
				 * Check our user authentification validity first.
				 */
				const validateLoginCall = await validateLoginAjax(token);

				/**
				 * Send the beers data.
				 */
				const beersCall = await pushAjax("beers", token, beers);
				dispatch(pushSuccess("beers", beers, beersCall.data));

				/**
				 * In the future, send the photos data.
				 */
				// const photosCall = await pushAjax("photos", token, photos);
				// dispatch(pushSuccess("photos", photos, photosCall.data));
			}

			/**
			 * When we get there, everything went well, we can finish our job.
			 */
			dispatch(stopLoading());
		} catch (errorData) {
			dispatch(stopLoading());

			if (errorData.type === "validateLogin") {
				/**
				 * We had a problem validating the user auth token, let's logout and display a message.
				 */
				dispatch(logout());
				dispatch(
					loginError(
						"Your user authentification has expired, please log in."
					)
				);
			} else {
				/**
				 * We had a problem with data synchronization (connectivity issue?).
				 */
				dispatch(
					pushError(`A problem occured during data synchronization.`)
				);
			}
		}
	};
};

/**
 * Make the "Push" AJAX request and return an axios Promise.
 * @param {string} type
 * @param {string} token
 * @param {array} data
 */
export const pushAjax = async (type, token, data) => {
	if (type === "photos") {
		/**
		 * Future: we'll also upload photos, we'll need to do a different axios call.
		 * For now, we're only sending JSON (text) data below.
		 */
	} else {
		return axios
			.post(
				"https://beerkip.mosaika.fr/wp-json/beerkip/v1/push",
				{
					type,
					data,
				},
				{
					headers: { Authorization: `Bearer ${token}` },
					timeout: 20000,
				}
			)
			.then(
				response => {
					return Promise.resolve(response);
				},
				error => {
					return Promise.reject({
						type,
						error,
					});
				}
			);
	}
};

/**
 * When a Push action is successful, we need to update our store to set edited:false or really delete the beers we've deleted.
 * @param {string} type
 * @param {array} objects
 * @param {array} response
 */
export const pushSuccess = (type, objects, response) => {
	return {
		type: PUSH_SUCCESS,
		objectsType: type,
		objects,
		response,
	};
};

/**
 * When a "push" action failed
 */
export const pushError = message => {
	return {
		type: PUSH_ERROR,
		message,
	};
};

/**
 * Make the login validity AJAX call and return an axios Promise.
 * @param {string} token
 */
export const validateLoginAjax = async token => {
	return axios
		.post(
			"https://beerkip.mosaika.fr/wp-json/jwt-auth/v1/token/validate",
			{},
			{
				headers: { Authorization: `Bearer ${token}` },
				timeout: 10000,
			}
		)
		.then(
			response => {
				if (response.status === 200) {
					return Promise.resolve(response);
				} else {
					return Promise.reject({
						type: "validateLogin",
						error: error,
					});
				}
			},
			error => {
				return Promise.reject({
					type: "validateLogin",
					error: error,
				});
			}
		);
};

/**
 * Pull data from the server, to populate user local app with previously-created data.
 */
export const pullData = () => {
	return async (dispatch, getState) => {
		dispatch(startLoading());

		try {
			const userId = getState().app.user.id;
			const token = getState().app.user.token;

			/**
			 * Check our user authentification validity first.
			 */
			const validateLoginCall = await validateLoginAjax(token);

			/**
			 * Get latest beers for current user
			 */
			const beersCall = await pullAjax("beers", userId, token);
			dispatch(pullSuccess("beers", beersCall.data));

			/**
			 * When we get there, everything went well, we can finish our job.
			 */
			dispatch(stopLoading());
		} catch (errorData) {
			dispatch(stopLoading());

			if (errorData.type === "validateLogin") {
				/**
				 * We had a problem validating the user auth token, let's logout and display a message.
				 */
				dispatch(logout());
				dispatch(
					loginError(
						"Your user authentification has expired, please log in."
					)
				);
			} else {
				/**
				 * We had a problem with pulling data (connectivity issue?).
				 */
				dispatch(
					pushError(
						`A problem occured when trying to sync your distant data locally.`
					)
				);
			}
		}
	};
};

/**
 * Make the "Push" AJAX request and return an axios Promise.
 * @param {string} type
 * @param {integer} userId
 * @param {string} token
 */
export const pullAjax = async (type, userId, token) => {
	return axios
		.post(
			"https://beerkip.mosaika.fr/wp-json/beerkip/v1/pull",
			{
				type,
				user_id: userId,
			},
			{
				headers: { Authorization: `Bearer ${token}` },
				timeout: 20000,
			}
		)
		.then(
			response => {
				return Promise.resolve(response);
			},
			error => {
				return Promise.reject({
					type,
					error,
				});
			}
		);
};

/**
 * When a Push action is successful, we need to update our store to populate it with data.
 * @param {string} type
 * @param {array} response
 */
export const pullSuccess = (type, response) => {
	return {
		type: PULL_SUCCESS,
		objectsType: type,
		response,
	};
};
