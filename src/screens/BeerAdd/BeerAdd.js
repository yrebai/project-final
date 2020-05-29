import React, { Component } from "react";
import { View } from "react-native";
import { Text, H3 } from "native-base";
import { connect } from "react-redux";
import UUIDGenerator from "react-native-uuid-generator";

import ScreenContent from "../../components/ScreenContent/ScreenContent";
import BeerAddForm from "../../components/BeerAddForm/BeerAddForm";

import { addBeer } from "../../store/actions/beers";

import dummyBeerImage from "../../assets/images/dummy/beer3.png";

class BeerAdd extends Component {
	handleBeerAddFormSubmit = values => {
		UUIDGenerator.getRandomUUID().then(uid => {
			// First, add the beer.
			this.props.addBeer({
				uid: uid,
				author: this.props.user.id,
				createdAt: Date.now(),
				edited: true,
				editedAt: null,
				deletedAt: null,
				photo: dummyBeerImage,
				...values,
			});

			// Then, redirect back to BeersList.
			this.props.navigation.navigate("BeersList");
		});
	};

	render() {
		return (
			<ScreenContent>
				<H3>New beer</H3>
				<BeerAddForm
					onSubmit={this.handleBeerAddFormSubmit}
					initialValues={{
						aromas: [
							{
								aroma: "",
							},
						],
					}}
				/>
			</ScreenContent>
		);
	}
}

const mapStateToProps = state => ({
	user: state.app.user,
});

const mapDispatchToProps = dispatch => {
	return {
		addBeer: data => dispatch(addBeer(data)),
	};
};

export default connect(
	mapStateToProps,
	mapDispatchToProps
)(BeerAdd);
