import { CoC7Check } from './check.js';
import { CoC7Item } from './items/item.js';
import { RollDialog } from './apps/roll-dialog.js';
import { chatHelper } from './chat/helper.js';

export class CoC7Utilities {
	// static test(event){
	// 	if( event.shiftKey) ui.notifications.info('Hello from SHIFT utilities');
	// 	else ui.notifications.info('Hello from utilities');
	// 	const speaker = ChatMessage.getSpeaker();
	// 	let actor;
	// 	if (speaker.token) actor = game.actors.tokens[speaker.token];
	// 	if (!actor) actor = game.actors.get(speaker.actor);

	// 	actor.inflictMajorWound();
	// }

	static ParseChatEntry( html,content){
		const regX = /(\S+)/g;
		const terms = content.match(regX);
		if( terms[0]?.toLowerCase() == '/r' && terms[1]?.toLowerCase().startsWith( '1d%')){
			CoC7Utilities._ExecCommand( content);
			return false;
		}
	}

	static async _ExecCommand( content){
		const options = content.toLowerCase().split(' ')?.join('')?.replace( '/r1d%', '');
		const check = new CoC7Check();
		if( options.length){
			let escaped = options;
			let threshold = undefined;
			let difficulty = CoC7Check.difficultyLevel.regular;
			let diceModifier = 0;
			let ask = false;
			let flatDiceModifier = undefined;
			let flatThresholdModifier = undefined;
			const thresholdRegex = new RegExp('[^\\(]+(?=\\))', 'g');
			const thresholdStr = escaped.match( thresholdRegex);
			if( thresholdStr && thresholdStr.length){
				threshold = Number( thresholdStr[0]);
				thresholdStr.forEach( match => escaped = escaped.replace( `(${match})`, ''));
			}
			const difficultydRegex = new RegExp('[^\\[]]+(?=\\])', 'g');
			const difficultyStr = escaped.match( difficultydRegex);
			if( difficultyStr && difficultyStr.length){
				difficulty = CoC7Utilities.convertDifficulty( difficultyStr[0]);
				difficultyStr.forEach( match => escaped = escaped.replace( `[${match}]`, ''));
			}
			if( escaped.includes( '?')){
				ask = true;
				escaped = escaped.replace( '?', '');
			}
			if( !isNaN(Number(escaped))) diceModifier = Number(escaped);

			if( ask){
				const dialogOptions={
					threshold: threshold,
					modifier: diceModifier,
					difficulty: difficulty,
					askValue: true
				};
				const usage = await RollDialog.create(dialogOptions);
				if( usage) {
					diceModifier = Number(usage.get('bonusDice'));
					difficulty = Number(usage.get('difficulty'));
					threshold = Number( usage.get('threshold')) || threshold;
					flatDiceModifier = Number( usage.get('flatDiceModifier'));
					flatThresholdModifier = Number( usage.get('flatThresholdModifier'));
				}
			}

			check.diceModifier = diceModifier || 0;
			check.difficulty = difficulty || CoC7Check.difficultyLevel.regular;
			check.rawValue = threshold;
			check.flatDiceModifier = flatDiceModifier;
			check.flatThresholdModifier = flatThresholdModifier;
			if( threshold) check.rawValue = !isNaN(threshold)?threshold:undefined;
		}
		const speaker = ChatMessage.getSpeaker();
		if( speaker.token && speaker.scene){
			const actor = chatHelper.getActorFromKey( `${speaker.scene}.${speaker.token}`);
			if( actor) check.actor = actor;
		} else if( speaker.actor){
			const actor = game.actors.get( speaker.actor);
			if( actor) check.actor = actor;
		}
		check.roll();
		check.toMessage();
	}

	static async test(){
		ui.notifications.infos('Do some stuff');
	}


	static getCreatureSanData( creature){
		let creatureData;
		let actor;
		if( 'CoCActor' === creature.constructor.name)
			actor = creature;

		if( 'string' === typeof(creature))
			actor = CoC7Utilities.getActorFromString( creature);
		
		if( actor){
			if( actor.isToken){
				const specie = game.actors.get(actor.id);				
				// The token has a different maximum san loss.
				// We assume it's a special represantant of his specie.
				// The san loss for encoutered creature will counted for that token in particular
				// and for the all specie
				if( specie && specie.sanLossMax != actor.sanLossMax){
					creatureData = {
						id: actor.token.id,
						name: actor.name,
						sanLossMax: actor.sanLossMax,
						specie: {
							id: specie.id,
							name: specie.name,
							sanLossMax: specie.sanLossMax
						}
					};
				} else {
					// If they induce the same SAN loos credit everything to the specie.
					// If the actor doen't exist in actor directory use the token data instead.
					creatureData = {
						id: specie?specie.id:actor.id,
						name: specie?specie.name:actor.name,
						sanLossMax: specie?specie.sanLossMax:actor.sanLossMax
					};
				}
			} else {
				creatureData = {
					id: actor.id,
					name: actor.name,
					sanLossMax: actor.sanLossMax
				};
			}
			return creatureData;				
		}
		else if( 'object' == typeof creature) return creature;
		return null;
	}

	static getActorFromString( actorString){
		let actor;

		// Token is better than actor.
		// Case 1 : trying with ID.
		// Case 1.1 : token found.
		if( game.actors.tokens[actorString]) return game.actors.tokens[actorString];
		// Case 1.2 : actor found.
		actor = game.actors.get( actorString);
		if( actor) return actor;

		// Case 2 : trying with name
		// Case 2.1 : token found.
		actor = Object.values(game.actors.tokens).find( t =>{
			if( t.name.toLowerCase() == actorString.toLowerCase()) return true;
			return false;
		});
		if( !actor){
			// Case 2.2 : actor found.
			actor = game.actors.find( a => {
				if( a.name.toLowerCase() == actorString.toLowerCase()) return true;
				return false;
			});
		}
		if( actor) return actor;


		// Case 3 string maybe an actorKey
		if( creature.includes('.')){
			let [, actorId] = key.split('.');
			return CoC7Utilities.getActorFromString( actorId);
		}

		//No joy
		return null;
	}

	static getCharacteristicNames( char){
		const charKey = char.toLowerCase();

		switch( charKey){
		case 'str': return { short: game.i18n.localize('CHARAC.STR'), label: game.i18n.localize('CHARAC.Strength')};
		case 'con': return { short: game.i18n.localize('CHARAC.CON'), label: game.i18n.localize('CHARAC.Constitution')};
		case 'siz': return { short: game.i18n.localize('CHARAC.SIZ'), label: game.i18n.localize('CHARAC.Size')};
		case 'dex': return { short: game.i18n.localize('CHARAC.DEX'), label: game.i18n.localize('CHARAC.Dexterity')};
		case 'app': return { short: game.i18n.localize('CHARAC.APP'), label: game.i18n.localize('CHARAC.Appearance')};
		case 'int': return { short: game.i18n.localize('CHARAC.INT'), label: game.i18n.localize('CHARAC.Intelligence')};
		case 'pow': return { short: game.i18n.localize('CHARAC.POW'), label: game.i18n.localize('CHARAC.Power')};
		case 'edu': return { short: game.i18n.localize('CHARAC.EDU'), label: game.i18n.localize('CHARAC.Education')};
		default: {
			for (const [, value] of Object.entries(game.system.template.Actor.templates.characteristics.characteristics)) {
				if( charKey == game.i18n.localize( value.short).toLowerCase()) return { short: game.i18n.localize(value.short), label: game.i18n.localize(value.label)};
			} 
			return null;
		}
		}
	}


	static convertDifficulty( difficulty){
		if( 0 == difficulty || '0' == difficulty) return CoC7Check.difficultyLevel.regular;
		if( typeof( difficulty) != 'string') return difficulty;
		if( !isNaN(Number(difficulty))) return Number(difficulty);

		switch (difficulty) {
		case '?':
			return CoC7Check.difficultyLevel.unknown;
		case '+':
			return CoC7Check.difficultyLevel.hard;
		case '++':
			return CoC7Check.difficultyLevel.extreme;
		case '+++':
			return CoC7Check.difficultyLevel.critical;
		default:
			return CoC7Check.difficultyLevel.regular;
		}
	}

	static skillCheckMacro( skill, event, options={}){
		event.preventDefault();
		const speaker = ChatMessage.getSpeaker();
		let actor;
		if (speaker.token) actor = game.actors.tokens[speaker.token];
		if (!actor) actor = game.actors.get(speaker.actor);

		if( !actor){
			ui.notifications.warn( game.i18n.localize( 'CoC7.WarnNoActorAvailable'));
			return;
		}

		actor.skillCheck( skill, event.shiftKey, options);
	}

	static weaponCheckMacro( weapon, event){
		event.preventDefault();
		const speaker = ChatMessage.getSpeaker();
		let actor;
		if (speaker.token) actor = game.actors.tokens[speaker.token]; //!! Ca recupere l'acteur pas l'acteur du token !!
		if (!actor) actor = game.actors.get(speaker.actor);

		if( !actor){
			ui.notifications.warn( game.i18n.localize( 'CoC7.WarnNoActorAvailable'));
			return;
		}
		
		actor.weaponCheck( weapon, event.shiftKey);
	}

	static async checkMacro( threshold = undefined, event = null){
		await CoC7Utilities.rollDice( event, {threshold: threshold});
	}

	static async createMacro(bar, data, slot){
		if ( data.type !== 'Item' ) return;

		let item;
		let origin;
		let packName = null;

		if (data.pack) {
			const pack = game.packs.get(data.pack);
			if (pack.metadata.entity !== 'Item') return;
			packName = data.pack;
			item = await pack.getEntity(data.id);
			origin = 'pack';
		} else if (data.data) {
			item = data.data;
			origin = 'actor';
		} else {
			item = game.items.get(data.id);
			origin = 'game';
		}

		if( !item) return ui.notifications.warn( game.i18n.localize( 'CoC7.WarnMacroNoItemFound'));
		if( !('weapon' == item.type) && !('skill' == item.type)) return ui.notifications.warn( game.i18n.localize( 'CoC7.WarnMacroIncorrectType'));

		let command;

		if( 'weapon' == item.type){
			command = `game.CoC7.macros.weaponCheck({name:'${item.name}', id:'${item._id}', origin:'${origin}', pack: '${packName}'}, event);`;
		}

		if( 'skill' == item.type){
			if( CoC7Item.isAnySpec( item)) return ui.notifications.warn( game.i18n.localize( 'CoC7.WarnNoGlobalSpec'));
			command = `game.CoC7.macros.skillCheck({name:'${item.name}', id:'${item._id}', origin:'${origin}', pack: '${packName}'}, event);`;
		}

		// Create the macro command
		let macro = game.macros.entities.find(m => (m.name === item.name) && (m.command === command));
		if ( !macro ) {
			macro = await Macro.create({
				name: item.name,
				type: 'script',
				img: item.img,
				command: command
			});
		}
		game.user.assignHotbarMacro(macro, slot);
		return false;
	}

	static async toggleDevPhase(){
		const isDevEnabled = game.settings.get('CoC7', 'developmentEnabled');
		await game.settings.set( 'CoC7', 'developmentEnabled', !isDevEnabled);
		let group = game.CoC7.menus.controls.find(b => b.name == 'main-menu');
		let tool = group.tools.find( t => t.name == 'devphase');
		tool.title = game.settings.get('CoC7', 'developmentEnabled')? game.i18n.localize( 'CoC7.DevPhaseEnabled'): game.i18n.localize( 'CoC7.DevPhaseDisabled');
		ui.notifications.info( game.settings.get('CoC7', 'developmentEnabled')? game.i18n.localize( 'CoC7.DevPhaseEnabled'): game.i18n.localize( 'CoC7.DevPhaseDisabled'));
		ui.controls.render();
		game.socket.emit('system.CoC7', {
			type : 'updateChar'
		});
		CoC7Utilities.updateCharSheets();
	}

	static async toggleCharCreation(){
		const isCharCreation = game.settings.get('CoC7', 'charCreationEnabled');
		await game.settings.set( 'CoC7', 'charCreationEnabled', !isCharCreation);
		let group = game.CoC7.menus.controls.find(b => b.name == 'main-menu');
		let tool = group.tools.find( t => t.name == 'charcreate');
		tool.title = game.settings.get('CoC7', 'charCreationEnabled')? game.i18n.localize( 'CoC7.CharCreationEnabled'): game.i18n.localize( 'CoC7.CharCreationDisabled');
		ui.notifications.info( game.settings.get('CoC7', 'charCreationEnabled')? game.i18n.localize( 'CoC7.CharCreationEnabled'): game.i18n.localize( 'CoC7.CharCreationDisabled'));
		ui.controls.render();
		game.socket.emit('system.CoC7', {
			type : 'updateChar'
		});		
		CoC7Utilities.updateCharSheets();
	}

	static async rollDice( event, options ={}){

		options.askValue = !options.threshold;
		let diceModifier, difficulty, flatDiceModifier, flatThresholdModifier;
		let threshold = options.threshold;

		if( undefined !== options.modifier) diceModifier = Number(options.modifier);
		if( undefined !== options.difficulty) difficulty = CoC7Utilities.convertDifficulty(options.difficulty);

		if( !event?.shiftKey && !options.fastForward){
			const usage = await RollDialog.create(options);
			if( usage) {
				diceModifier = Number(usage.get('bonusDice'));
				difficulty = Number(usage.get('difficulty'));
				threshold = Number( usage.get('threshold'));
				flatDiceModifier = Number( usage.get('flatDiceModifier'));
				flatThresholdModifier = Number( usage.get('flatThresholdModifier'));
			}
		}

		const actors = [];

		if( game.user.isGM && canvas.tokens.controlled.length){
			canvas.tokens.controlled.forEach( token =>{  actors.push( token.actor.tokenKey);  });
		} else if( game.user.character){
			actors.push(game.user.character.tokenKey);
		}

		actors.forEach( tk => {
			const check = new CoC7Check();
			check.diceModifier = diceModifier || 0;
			check.difficulty = difficulty || CoC7Check.difficultyLevel.regular;
			check.rawValue = threshold;
			check.flatDiceModifier = flatDiceModifier;
			check.flatThresholdModifier = flatThresholdModifier;
			check.actor = tk;
			check.roll();
			check.toMessage();
		});

		if( !actors.length){
			const check = new CoC7Check();
			check.diceModifier = diceModifier || 0;
			check.difficulty = difficulty || CoC7Check.difficultyLevel.regular;
			check.rawValue = threshold;
			check.flatDiceModifier = flatDiceModifier;
			check.flatThresholdModifier = flatThresholdModifier;
			check.roll();
			check.toMessage();
		}
	}

	static updateCharSheets(){
		if( game.user.isGM){
			game.actors.entities.forEach( a => {
				if( 'character' == a?.data?.type && a?.sheet && a?.sheet?.rendered){
					a.update( { ['data.flags.locked']: true});
					a.render( false);
				}
			});
		} else{
			game.actors.entities.forEach( a => {
				if( a.owner){
					a.update( { ['data.flags.locked']: true});
					a.render( false);
				}
			});
		}		
		return;
	}
}