import {FILTER_ON_TITLE} from '../actions/actionTypes';

const initialState = '';

const titleFilterReducer = (state = initialState, action) =>
{
	switch (action.type)
	{
		case FILTER_ON_TITLE:
			return action.title;
		default:
			return state;
	}
};

export default titleFilterReducer;