import React, {Component, PropTypes} from 'react';
import Grid from 'react-bootstrap/lib/Grid';
import Row from 'react-bootstrap/lib/Row';
import Col from 'react-bootstrap/lib/Col';
import Thumbnail from 'react-bootstrap/lib/Thumbnail';
import Panel from 'react-bootstrap/lib/Panel';
import Button from 'react-bootstrap/lib/Button';
import Table from 'react-bootstrap/lib/Table';
import ButtonToolbar from 'react-bootstrap/lib/ButtonToolbar';
import Jumbotron from 'react-bootstrap/lib/Jumbotron';
import {Link} from 'react-router';
import ReactDisqusThread from 'react-disqus-thread';
import CopyToClipboard from 'react-copy-to-clipboard';
import FontAwesome from 'react-fontawesome';
import marked from 'marked';
import moment from 'moment';
import base from '../base';
import NoMatch from './NoMatch';
import buildImageUrl from '../helpers/buildImageUrl';
import decodeFromBase64 from '../parser/decodeFromBase64';
import luaTableToJsonObject from '../parser/luaTableToJsonObject';
import countBy from 'lodash/fp/countBy';
import toPairs from 'lodash/fp/toPairs';
import sortBy from 'lodash/fp/sortBy';
import reverse from 'lodash/fp/reverse';
import flow from 'lodash/fp/flow';

class SingleBlueprint extends Component {
	static propTypes = {
		id         : PropTypes.string.isRequired,
		user       : PropTypes.shape({
			userId     : PropTypes.string.isRequired,
			displayName: PropTypes.string,
		}),
		isModerator: PropTypes.bool,
	};

	static contextTypes = {router: PropTypes.object.isRequired};

	state = {
		expandBlueprint: false,
		loading        : true,
	};

	componentWillMount()
	{
		this.ref = base.syncState(`/blueprints/${this.props.id}`, {
			context: this,
			state  : 'blueprint',
			then   : () => this.setState({loading: false}),
		});
	}

	componentWillUnmount()
	{
		base.removeBinding(this.ref);
	}

	handleFavorite = () =>
	{
		const blueprint            = this.state.blueprint;
		const favorites            = blueprint.favorites;
		const userId               = this.props.user.userId;
		const wasFavorite          = favorites && favorites[userId];
		const numberOfFavorites    = blueprint.numberOfFavorites;
		const newNumberOfFavorites = numberOfFavorites + (wasFavorite ? -1 : 1);

		base.database().ref(`/blueprints/${this.props.id}/favorites/${userId}`).set(!wasFavorite);
		base.database().ref(`/blueprints/${this.props.id}/numberOfFavorites`).set(newNumberOfFavorites);
		base.database().ref(`/users/${userId}/favorites/${this.props.id}`).set(!wasFavorite);
	};

	handleExpandCollapse = (event) =>
	{
		event.preventDefault();
		this.setState({expandBlueprint: !this.state.expandBlueprint});
	};

	renderFavoriteButton = () =>
	{
		const user = this.props.user;

		if (!user)
		{
			return <div />;
		}

		const favorites  = this.state.blueprint.favorites;
		const myFavorite = favorites && user && favorites[user.userId];
		const iconName   = myFavorite ? 'heart' : 'heart-o';

		return (
			<Button bsSize='large' className='pull-right' onClick={this.handleFavorite}>
				<FontAwesome name={iconName} />{' Favorite'}
			</Button>
		);
	};

	renderEditButton = () =>
		<Button
			bsSize='large'
			className='pull-right'
			onClick={() => this.context.router.transitionTo(`/edit/${this.props.id}`)}>
			<FontAwesome name='edit' />{' Edit'}
		</Button>;

	parseBlueprint = (blueprintString) =>
	{
		try
		{
			const luaTable      = decodeFromBase64(blueprintString);
			const blueprintJson = luaTableToJsonObject(luaTable);
			return blueprintJson;
		}
		catch (e)
		{
			console.error(e);
			return undefined;
		}
	};

	entityHistogram = parsedBlueprint =>
		flow(
			countBy('name'),
			toPairs,
			sortBy(1),
			reverse
		)(parsedBlueprint.entities);

	render()
	{
		if (this.state.loading)
		{
			return <Jumbotron>
				<h1>
					<FontAwesome name='cog' spin />
					{' Loading data'}
				</h1>
			</Jumbotron>;
		}

		const blueprint = this.state.blueprint;
		if (!blueprint)
		{
			return <NoMatch />;
		}

		const image            = blueprint.image;
		const thumbnail        = buildImageUrl(image.id, image.type, 'l');
		const renderedMarkdown = marked(blueprint.descriptionMarkdown);
		const createdDate      = blueprint.createdDate;
		const lastUpdatedDate  = blueprint.lastUpdatedDate;
		const parsedBlueprint  = this.parseBlueprint(blueprint.blueprintString);

		const ownedByCurrentUser = this.props.user && this.props.user.userId === blueprint.author.userId;

		const showOrHide = this.state.expandBlueprint ? 'Hide' : 'Show';

		return <Grid>
			<div className='page-header'>
				<div className='btn-toolbar pull-right'>
					{!ownedByCurrentUser && this.renderFavoriteButton()}
					{(ownedByCurrentUser || this.props.isModerator) && this.renderEditButton()}
				</div>
				<h1>{blueprint.title}</h1>
			</div>
			<Row>
				<Col md={4}>
					<Thumbnail
						href={image.link}
						src={thumbnail}
						target='_blank'
					/>
					<Panel header='Info'>
						<Table bordered hover fill>
							<tbody>
								<tr>
									<td><FontAwesome name='user' size='lg' fixedWidth />{' Author'}</td>
									<td>
										<Link to={`/user/${blueprint.author.userId}`}>
											{blueprint.author.displayName}
											{ownedByCurrentUser && <span className='pull-right'><b>{'(You)'}</b></span>}
										</Link>
									</td>
								</tr>
								<tr>
									<td><FontAwesome name='calendar' size='lg' fixedWidth />{' Created'}</td>
									<td>
										<span
											title={moment(createdDate).format('dddd, MMMM Do YYYY, h:mm:ss a')}>{moment(createdDate).fromNow()}</span>
									</td>
								</tr>
								<tr>
									<td><FontAwesome name='clock-o' size='lg' fixedWidth />{' Last Updated'}</td>
									<td>
										<span
											title={moment(lastUpdatedDate).format('dddd, MMMM Do YYYY, h:mm:ss a')}>{moment(lastUpdatedDate).fromNow()}</span>
									</td>
								</tr>
								<tr>
									<td><FontAwesome name='heart' size='lg' fixedWidth />{' Favorites'}</td>
									<td>{blueprint.numberOfFavorites}</td>
								</tr>
							</tbody>
						</Table>
					</Panel>
					{parsedBlueprint && !parsedBlueprint.book && <Panel header='Requirements'>
						<Table bordered hover fill>
							<tbody>
								{this.entityHistogram(parsedBlueprint).map(pair =>
									<tr key={pair[0]}>
										<td>{pair[1]}</td>
										<td>{pair[0]}</td>
									</tr>)}
							</tbody>
						</Table>
					</Panel>}
					{parsedBlueprint && <Panel header='Extra Info'>
						<Table bordered hover fill>
							<tbody>
								<tr>
									<td>Name</td>
									<td>{parsedBlueprint.name || (parsedBlueprint.data && parsedBlueprint.data.label)}</td>
								</tr>
								{parsedBlueprint.book && <tr>
									<td colSpan='2'>
										Blueprint book with {parsedBlueprint.book.length} blueprints.
									</td>
								</tr>}
								{(parsedBlueprint.icons || [])
									.filter(icon => icon != null)
									.map(icon =>
									{
										return <tr key={icon.index}>
											<td>Icon {icon.index}</td>
											<td>{icon.signal.name}</td>
										</tr>
									})}
							</tbody>
						</Table>
					</Panel>}
				</Col>
				<Col md={8}>
					<Panel header='Details'>
						<div dangerouslySetInnerHTML={{__html: renderedMarkdown}} />
					</Panel>
				</Col>
				<Col md={8}>
					<Panel>
						<ButtonToolbar>
							<CopyToClipboard text={blueprint.blueprintString}>
								<Button bsStyle='primary'>
									<FontAwesome name='clipboard' size='lg' fixedWidth />
									{' Copy to Clipboard'}
								</Button>
							</CopyToClipboard>
							<Button onClick={this.handleExpandCollapse}>
								<FontAwesome name='expand' size='lg' fixedWidth flip='horizontal' />
								{` ${showOrHide} Blueprint`}
							</Button>
						</ButtonToolbar>
					</Panel>
				</Col>
				<Col md={8}>
					<Panel header='Blueprint String' collapsible expanded={this.state.expandBlueprint}>
						<div className='blueprintString'>
							{blueprint.blueprintString}
						</div>
					</Panel>
				</Col>
			</Row>
			<Row>
				<ReactDisqusThread
					shortname='factorio-blueprints'
					identifier={this.props.id}
					title={blueprint.title}
				/>
			</Row>
		</Grid>;
	}
}

export default SingleBlueprint;
