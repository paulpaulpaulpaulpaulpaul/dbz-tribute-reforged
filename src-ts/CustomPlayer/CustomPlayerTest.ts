import { CustomPlayer } from "./CustomPlayer";
import { CustomHero } from "CustomHero/CustomHero";
import { Constants } from "Common/Constants";
import { ToolTipOrganizer } from "Common/ToolTipOrganizer";
import { CustomAbilityInput } from "CustomAbility/CustomAbilityInput";
import { CustomAbility } from "CustomAbility/CustomAbility";
import { abilityCodesToNames } from "CustomAbility/AbilityCodesToNames";
import { TextTagHelper } from "Common/TextTagHelper";
import { Colorizer } from "Common/Colorizer";
import { WinLossHelper } from "Common/WinLossHelper";
import { TournamentManager } from "Core/TournamentSystem/TournamentManager";
import { FrameHelper } from "Common/FrameHelper";
import { ExperienceManager } from "Core/ExperienceSystem/ExpierenceManager";

// global?
let customPlayers: CustomPlayer[];

export function addAbilityAction(abilityTrigger: trigger, name: string) {
  TriggerAddAction(abilityTrigger, () => {
    const player = GetTriggerPlayer();
    const playerId = GetPlayerId(player);
    // NOTE: do not use GetUnitsSelectedAll(GetTriggerPlayer())
    // it will cause weird selection bugs during multiplayer
    // that is not normally testable via singleplayer

    // const customHero = customPlayers[playerId].getCurrentlySelectedCustomHero();
    for (const customHero of customPlayers[playerId].allHeroes) {
      if (customHero && IsUnitSelected(customHero.unit, player)) {
        const abilityInput = new CustomAbilityInput(
          customHero,
          player,
          1,
          customPlayers[playerId].orderPoint,
          customPlayers[playerId].mouseData,
          customPlayers[playerId].lastCastPoint.clone(),
          customPlayers[playerId].targetUnit,
          customPlayers[playerId].lastCastUnit,
        );

        if (customHero.canCastAbility(name, abilityInput)) {
          // show custom ability name on activation, if castable
          TextTagHelper.showPlayerColorTextOnUnit(name, playerId, customHero.unit);
        }
        customHero.useAbility(name, abilityInput);
      }
    }
  });
}

export function addKeyEvent(trigger: trigger, oskey: oskeytype, metaKey: number, keyDown: boolean) {
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    BlzTriggerRegisterPlayerKeyEvent(trigger, Player(i), oskey, metaKey, keyDown);
  }
}

export function setAbilityUIToAbility(
  hero: CustomHero, 
  index: number, 
  tooltipName: string,
  tooltipTitle: string,
  tooltipBody: string,
  iconEnabled: string,
  iconDisabled: string,
) {
  BlzFrameSetTexture(BlzGetFrameByName("MyAbilityIconBar", index), iconEnabled, 0, true);
  BlzFrameSetTexture(BlzGetFrameByName("MyAbilityIconBarBackground", index), iconDisabled, 0, true);
  BlzFrameSetText(BlzGetFrameByName("MyToolTipTextTitle", index), tooltipTitle);
  BlzFrameSetText(BlzGetFrameByName("MyToolTipTextValue", index), tooltipBody);
  ToolTipOrganizer.resizeToolTipHeightByValue(BlzGetFrameByName(tooltipName, index), tooltipBody);
}

export function updateHeroAbilityCD(heroAbility: CustomAbility, index: number, cdText: string, cdValue: number) {
  BlzFrameSetValue(BlzGetFrameByName("MyAbilityIconBar", index), cdValue);
  BlzFrameSetText(BlzGetFrameByName("MyAbilityIconBarText", index), cdText);
}

export function updateSelectedUnitBars(
  unit: unit,
  currentHp: string, 
  maxHp: string, 
  currentMp: string,
  maxMp: string,
  level: string,
  percentXp: number,
) {
  BlzFrameSetValue(BlzGetFrameByName("MyHPBar", 0), GetUnitLifePercent(unit));
  BlzFrameSetValue(BlzGetFrameByName("MyMPBar", 0), GetUnitManaPercent(unit));
  BlzFrameSetValue(BlzGetFrameByName("MyLevelBar", 0), percentXp);
  BlzFrameSetText(BlzGetFrameByName("MyHPBarText", 0), currentHp + " / " + maxHp);
  BlzFrameSetText(BlzGetFrameByName("MyMPBarText", 0), currentMp + " / " + maxMp);
  BlzFrameSetText(BlzGetFrameByName("MyLevelBarText", 0), "LVL: " + level);
}

export function CustomPlayerTest() {
  
  customPlayers = [];
  
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    customPlayers[i] = new CustomPlayer(
      i,
      GetPlayerName(Player(i)),
    );
  }

  // need better way to add heroes of player to their hero list
  const addHeroToPlayer = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerSelectionEventBJ(addHeroToPlayer, Player(i), true);
  }
	TriggerAddAction(addHeroToPlayer, () => {
    const addedHero = GetTriggerUnit();
    const player = GetTriggerPlayer();
    const playerId = GetPlayerId(player);
    customPlayers[playerId].addHero(addedHero);
    customPlayers[playerId].selectedUnit = GetTriggerUnit();

    for (let i = 0 ; i < Constants.maxSubAbilities; ++i) {
      let customHero = customPlayers[playerId].getLastSelectedOwnedCustomHero();
      // prevent string table desyncs
      let tooltipName = "abilityButton" + i + "ToolTip";
      if (customHero) {
        let heroAbility = customHero.getAbilityByIndex(i);
        if (heroAbility) {
          let tooltipTitle = heroAbility.tooltip.title;
          let tooltipBody = heroAbility.tooltip.body;
          let iconEnabled = heroAbility.icon.enabled;
          let iconDisabled = heroAbility.icon.disabled;
          // BJDebugMsg(tooltipName + " " + tooltipTitle + " " + tooltipBody + " " + iconEnabled + " " + iconDisabled);
          
          // register abilities to UI frames
          if (GetTriggerPlayer() == GetLocalPlayer()) {
            setAbilityUIToAbility(
              customHero, 
              i, 
              tooltipName, 
              tooltipTitle, 
              tooltipBody, 
              iconEnabled, 
              iconDisabled
            );
          }
        }
      }
    }
	});
  

  // update mouse positions for now
  // might be a bit laggy?
  const updatePlayerMouseData = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerMouseEventBJ(updatePlayerMouseData, Player(i), bj_MOUSEEVENTTYPE_MOVE);
	}
	TriggerAddAction(updatePlayerMouseData, () => {
    const player = GetTriggerPlayer();
    const playerId = GetPlayerId(player);
    if (GetPlayerSlotState(player) == PLAYER_SLOT_STATE_PLAYING) {
      const x = BlzGetTriggerPlayerMouseX();
      const y = BlzGetTriggerPlayerMouseY();
      if (x != 0 && y != 0) {
        customPlayers[playerId].mouseData.x = x;
        customPlayers[playerId].mouseData.y = y;
      }
    }
  });


  const updatePlayerOrderPoint = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerUnitEventSimple(updatePlayerOrderPoint, Player(i), EVENT_PLAYER_UNIT_ISSUED_POINT_ORDER);
  }
  TriggerAddCondition(updatePlayerOrderPoint, Condition(() => {
    return GetPlayerSlotState(GetTriggerPlayer()) == PLAYER_SLOT_STATE_PLAYING;
  }));
  TriggerAddAction(updatePlayerOrderPoint, () => {
    const x = GetOrderPointX();
    const y = GetOrderPointY();
    if (x != 0 && y != 0) {
      const playerId = GetPlayerId(GetTriggerPlayer());
      customPlayers[playerId].orderPoint.x = x;
      customPlayers[playerId].orderPoint.y = y;
    }
  });

  const updatePlayerTargetPoint = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerUnitEventSimple(updatePlayerTargetPoint, Player(i), EVENT_PLAYER_UNIT_ISSUED_TARGET_ORDER);
  }
  TriggerAddCondition(updatePlayerTargetPoint, Condition(() => {
    return GetPlayerSlotState(GetTriggerPlayer()) == PLAYER_SLOT_STATE_PLAYING;
  }));
  TriggerAddAction(updatePlayerTargetPoint, () => {
    const playerId = GetPlayerId(GetTriggerPlayer());
    customPlayers[playerId].targetUnit = GetOrderTargetUnit();
    customPlayers[playerId].orderPoint.x = GetUnitX(customPlayers[playerId].targetUnit);
    customPlayers[playerId].orderPoint.y = GetUnitY(customPlayers[playerId].targetUnit);
  });

  const updatePlayerLastCastPoint = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerUnitEventSimple(updatePlayerLastCastPoint, Player(i), EVENT_PLAYER_UNIT_SPELL_CAST);
  }
  TriggerAddCondition(updatePlayerLastCastPoint, Condition(() => {
    return GetPlayerSlotState(GetTriggerPlayer()) == PLAYER_SLOT_STATE_PLAYING;
  }));
  TriggerAddAction(updatePlayerLastCastPoint, () => {
    const playerId = GetPlayerId(GetTriggerPlayer());
    customPlayers[playerId].lastCastPoint.x = GetSpellTargetX();
    customPlayers[playerId].lastCastPoint.y = GetSpellTargetY();
  });

  const linkNormalAbilityToCustomAbility = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerUnitEventSimple(linkNormalAbilityToCustomAbility, Player(i), EVENT_PLAYER_UNIT_SPELL_EFFECT);
  }
  TriggerAddAction(linkNormalAbilityToCustomAbility, () => {
    const player = GetTriggerPlayer();
    const playerId = GetPlayerId(player);
    const abilityId = GetSpellAbilityId();
    customPlayers[playerId].lastCastUnit = GetSpellTargetUnit();

    if (IsUnitType(GetTriggerUnit(), UNIT_TYPE_HERO)) {
      // show ability name on activation
      TextTagHelper.showPlayerColorTextOnUnit(GetAbilityName(abilityId), playerId, GetTriggerUnit());
    }

    const spellName = abilityCodesToNames.get(abilityId);

    if (spellName) { 
      const caster = GetTriggerUnit();
      const abilityLevel = GetUnitAbilityLevel(caster, abilityId);
      customPlayers[playerId].selectedUnit = caster;
      /*
      if (GetOrderTargetUnit()) {
        customPlayers[playerId].targetUnit = GetOrderTargetUnit();
      }
      */
      const customHero = customPlayers[playerId].getCurrentlySelectedCustomHero();
      if (customHero) {
        // temp fix for double ss rage trigger
        if (spellName != "Super Saiyan Rage" || GetUnitTypeId(customHero.unit) != FourCC("H08I")) {
          customHero.useAbility(
            spellName,
            new CustomAbilityInput(
              customHero,
              player,
              abilityLevel,
              customPlayers[playerId].orderPoint,
              customPlayers[playerId].mouseData,
              customPlayers[playerId].lastCastPoint.clone(),
              customPlayers[playerId].targetUnit,
              GetSpellTargetUnit(),
            ),
          );
        }
      }
    }

  });

  
  // zanzo activation trigger
  // tied to z for now
  const abil0 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil0, BlzGetFrameByName("abilityButton0", 0), FRAMEEVENT_CONTROL_CLICK);
  // replace key events with more organized method of key reading
  addKeyEvent(abil0, OSKEY_Z, 0, true);
  addAbilityAction(abil0, "Zanzo Dash");

  const abil1 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil1, BlzGetFrameByName("abilityButton1", 1), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil1, OSKEY_X, 0, true);
  addAbilityAction(abil1, "Guard");

  const abil2 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil2, BlzGetFrameByName("abilityButton2", 2), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil2, OSKEY_C, 0, true);
  addAbilityAction(abil2, "Max Power");
  
  /*

  const abil3 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil3, BlzGetFrameByName("abilityButton3", 3), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil3, OSKEY_Q, 0, true);
  addAbilityAction(abil3, "Future Sight");

  const abil4 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil4, BlzGetFrameByName("abilityButton4", 4), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil4, OSKEY_W, 0, true);
  addAbilityAction(abil4, "Tyrant Lancer");

  const abil5 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil5, BlzGetFrameByName("abilityButton5", 5), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil5, OSKEY_E, 0, true);
  addAbilityAction(abil5, "Riot Javelin");

  const abil6 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil6, BlzGetFrameByName("abilityButton6", 6), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil6, OSKEY_R, 0, true);
  addAbilityAction(abil6, "Rebellion Spear");

  const abil7 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil7, BlzGetFrameByName("abilityButton7", 7), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil7, OSKEY_D, 0, true);
  addAbilityAction(abil7, "Angry Shout");

  const abil8 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil8, BlzGetFrameByName("abilityButton8", 8), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil8, OSKEY_F, 0, true);
  addAbilityAction(abil8, "Saiyan Spirit");








  const abil9 = CreateTrigger();
  BlzTriggerRegisterFrameEvent(abil9, BlzGetFrameByName("abilityButton9", 9), FRAMEEVENT_CONTROL_CLICK);
  addKeyEvent(abil9, OSKEY_V, 0, true);
  addAbilityAction(abil9, "SS Rage");
  */


  // UI info for selected unit
	TimerStart(CreateTimer(), 0.03, true, () => {
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      let playerId = i;
      let unit = customPlayers[playerId].selectedUnit;

      if (unit) {
        // make sure strings dont desync
        const currentHp = I2S(Math.max(0, R2I(GetUnitState(unit, UNIT_STATE_LIFE))));
        const maxHp = I2S(BlzGetUnitMaxHP(unit));
        const currentMp = I2S(Math.max(0, R2I(GetUnitState(unit, UNIT_STATE_MANA))));
        const maxMp = I2S(BlzGetUnitMaxMana(unit));
        let percentXp = 0;
        if (IsUnitType(unit, UNIT_TYPE_HERO)) {
          const currentLevelXp = ExperienceManager.getInstance().getHeroReqLevelXP(GetHeroLevel(unit));
          const nextLevelXp = ExperienceManager.getInstance().getHeroReqLevelXP(GetHeroLevel(unit) + 1);
          const currentXp = GetHeroXP(unit) - currentLevelXp;
          const maxXp = nextLevelXp - currentLevelXp;
          percentXp = Math.min(100, 100 * currentXp / Math.max(1, maxXp))
        }
        const level = I2S(GetUnitLevel(unit));

        // update stats
        let strength = "|cffff2020STR:|n";
        let agility = "|cff20ff20AGI:|n";
        let intelligence = "|cff20ffffINT:|n";

        if (IsUnitType(unit, UNIT_TYPE_HERO)) {
          strength += I2S(GetHeroStr(unit, true));
          agility += I2S(GetHeroAgi(unit, true));
          intelligence += I2S(GetHeroInt(unit, true));
        } else {
          strength += "0";
          agility += "0";
          intelligence += "0";
        }
        strength += "|r";
        agility += "|r";
        intelligence += "|r";

        const unitPanel = BlzGetFrameByName("SimpleInfoPanelUnitDetail", 0);
        const inventoryCover = BlzGetFrameByName("SimpleInventoryCover", 0);
        const inventoryCoverTexture = BlzGetFrameByName("SimpleInventoryCoverTexture", 0);

        if (GetPlayerId(GetLocalPlayer()) == playerId) {
          updateSelectedUnitBars(unit, currentHp, maxHp, currentMp, maxMp, level, percentXp);
          BlzFrameSetText(BlzGetFrameByName("heroStatStrengthText", 0), strength);
          BlzFrameSetText(BlzGetFrameByName("heroStatAgilityText", 0), agility);
          BlzFrameSetText(BlzGetFrameByName("heroStatIntelligenceText", 0), intelligence);
          if (customPlayers[playerId].usingCustomUI) {
            BlzFrameSetVisible(unitPanel, false);
            BlzFrameSetVisible(inventoryCover, false);
            BlzFrameSetVisible(inventoryCoverTexture, false);
          }
        }
      }

      // make sure strings dont desync
      let ownedHero = customPlayers[playerId].getLastSelectedOwnedCustomHero();
      if (ownedHero) {
        for (let j = 0; j < Constants.maxSubAbilities; ++j) {
          let heroAbility = ownedHero.getAbilityByIndex(j);
          if (heroAbility) {
            let cdText = "";
            let abilityCd = heroAbility.currentCd;
            if (abilityCd > 0) {
              cdText = R2SW(abilityCd,2,2) + "s";
            }
            // BJDebugMsg(cdText);
            if (GetPlayerId(GetLocalPlayer()) == playerId) {
              // POSSIBLY LAGGY
              // might be a bit slow having to constantly update text and icon, but we'll see
              let cdValue = 100 * (1 - heroAbility.currentCd / heroAbility.maxCd);
              updateHeroAbilityCD(heroAbility, j, cdText, cdValue);
            }
          }
        }
      }
    }
  });



  // ==== custom ui 2.0 ====
	// hides the standard ui
	// shows LHS hero bar buttons
	// minimap + minimap buttons
	// chat msgs, game msgs
	// hides first 5 command buttons
	// sets parent of inventory to parent of bottom right command buttons
	const hideTrig = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(hideTrig, Player(i), "iseedeadui", true);
	}
	TriggerAddAction(hideTrig, () => {
    const playerId = GetPlayerId(GetTriggerPlayer());
    customPlayers[playerId].usingCustomUI = true;

		const grandpa = BlzGetOriginFrame(ORIGIN_FRAME_GAME_UI, 0);
		const worldFrame = BlzGetOriginFrame(ORIGIN_FRAME_WORLD_FRAME, 0);
		const rm = BlzGetFrameByName("ConsoleUIBackdrop", 0);

		const upperBar = BlzGetFrameByName("UpperButtonBarFrame", 0);
    const resourceBar = BlzGetFrameByName("ResourceBarFrame", 0);

    const abilityButtonHotbar = BlzGetFrameByName("abilityButtonHotBar", 0);
    
    const hpBar = BlzGetFrameByName("MyHPBar", 0);
    const mpBar = BlzGetFrameByName("MyMPBar", 0);

		const heroBarButtons = BlzGetOriginFrame(ORIGIN_FRAME_HERO_BAR, 0);
		
		const minimap = BlzGetOriginFrame(ORIGIN_FRAME_MINIMAP, 0);
		const minimapParent = BlzFrameGetParent(minimap);
		const minimapButtons: framehandle[] = [];
		for (let i = 0; i < 5; ++i) {
			minimapButtons.push(BlzGetOriginFrame(ORIGIN_FRAME_MINIMAP_BUTTON, i));
		}

		const chatMsg = BlzGetOriginFrame(ORIGIN_FRAME_CHAT_MSG, 0);
		const gameMsg = BlzGetOriginFrame(ORIGIN_FRAME_UNIT_MSG, 0);

    const heroPortrait = BlzGetOriginFrame(ORIGIN_FRAME_PORTRAIT, 0);
		const unitPanel = BlzGetFrameByName("SimpleInfoPanelUnitDetail", 0);
    const unitPanelParent = BlzFrameGetParent(unitPanel);
    
    const inventoryCover = BlzGetFrameByName("SimpleInventoryCover", 0);
    const inventoryCoverTexture = BlzGetFrameByName("SimpleInventoryCoverTexture", 0);

		const inventoryParent = BlzFrameGetParent(BlzGetOriginFrame(ORIGIN_FRAME_ITEM_BUTTON, 0));
		// const inventoryFrames: framehandle[] = [];
		// inventoryFrames.push(BlzGetFrameByName("SimpleInventoryCover",0));
		// inventoryFrames.push(BlzGetFrameByName("SimpleInventoryBar",0));
		// inventoryFrames.push(BlzGetFrameByName("InventoryCoverTexture",0));
		// inventoryFrames.push(BlzGetFrameByName("InventoryText",0));

		const inventoryButtons: framehandle[] = [];
		for (let i = 0; i < 6; ++i) {
			const frame = BlzGetOriginFrame(ORIGIN_FRAME_ITEM_BUTTON, i);
			inventoryButtons.push(frame);
			// inventoryFrames.push(frame);
		}

		const commandCardParent = BlzFrameGetParent(BlzGetOriginFrame(ORIGIN_FRAME_COMMAND_BUTTON, 0));
		const commandCardButtons: framehandle[] = [];
		for (let i = 0; i < 12; ++i) {
			commandCardButtons.push(BlzGetOriginFrame(ORIGIN_FRAME_ITEM_BUTTON, i));
    }
    
    const customStrengthLabel = BlzGetFrameByName("heroStatStrengthText", 0);
    const customAgilityLabel = BlzGetFrameByName("heroStatAgilityText", 0);
    const customIntelligenceLabel = BlzGetFrameByName("heroStatIntelligenceText", 0);

		if (GetLocalPlayer() == GetTriggerPlayer()) {
			BlzHideOriginFrames(true);
			BlzFrameSetAllPoints(worldFrame, grandpa);
			// let frame = BlzGetFrameByName("ConsoleUI", 0);
			// BlzFrameSetAllPoints(frame, grandpa);
			// BlzFrameSetPoint(frame, FRAMEPOINT_BOTTOM, grandpa, FRAMEPOINT_BOTTOM, -1, -1);
			BlzFrameSetVisible(rm, false);

			BlzFrameSetVisible(upperBar, true);
      BlzFrameSetVisible(resourceBar, true);
      
      BlzFrameClearAllPoints(abilityButtonHotbar);
      BlzFrameSetPoint(
        abilityButtonHotbar, 
        FRAMEPOINT_BOTTOMRIGHT, 
        hpBar, 
        FRAMEPOINT_TOPRIGHT, 
        -0.008, 0.001
      );

      BlzFrameClearAllPoints(hpBar);
      BlzFrameSetPoint(hpBar, FRAMEPOINT_BOTTOM, grandpa, FRAMEPOINT_BOTTOM, 0, 0.02);
      BlzFrameClearAllPoints(mpBar);
      BlzFrameSetPoint(mpBar, FRAMEPOINT_TOP, hpBar, FRAMEPOINT_BOTTOM, 0, 0.00);
			
			BlzFrameSetVisible(heroBarButtons, true);

			BlzFrameSetVisible(minimapParent, true);
			BlzFrameSetVisible(minimap, true);
			// buttons still not showing up
			FrameHelper.setFramesVisibility(minimapButtons, true);

			BlzFrameSetVisible(chatMsg, true);
			BlzFrameSetVisible(gameMsg, true);

      BlzFrameSetVisible(heroPortrait, true);
      BlzFrameClearAllPoints(heroPortrait);
      BlzFrameSetPoint(heroPortrait, FRAMEPOINT_BOTTOM, hpBar, FRAMEPOINT_TOP, -0.13, 0.003);
      BlzFrameSetSize(heroPortrait, 0.08, 0.08);

      BlzFrameSetVisible(unitPanelParent, true);
      BlzFrameSetVisible(unitPanel, false);

      BlzFrameSetVisible(inventoryCover, false);
      BlzFrameSetVisible(inventoryCoverTexture, false);
      
			BlzFrameSetParent(inventoryParent, commandCardParent);

			BlzFrameSetVisible(commandCardParent, true);
			BlzFrameSetVisible(inventoryParent, true);
			FrameHelper.setFramesVisibility(inventoryButtons, true);
			// FrameHelper.setFramesVisibility(inventoryFrames, true);

			// heroStatsUI.setRenderVisible(true);
			BlzFrameSetVisible(customStrengthLabel, true);
			BlzFrameSetVisible(customAgilityLabel, true);
			BlzFrameSetVisible(customIntelligenceLabel, true);
		}
	});

	const resetUnitPanelTrigger = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(resetUnitPanelTrigger, Player(i), "hideunitpanel", true);
	}
	TriggerAddAction(resetUnitPanelTrigger, () => {
		const unitPanel = BlzGetFrameByName("SimpleInfoPanelUnitDetail", 0);
		const unitPanelParent = BlzFrameGetParent(unitPanel);
		
		const toBeHidden: framehandle[] = [
			// BlzGetFrameByName("SimpleInfoPanelIconDamage", 0),
			// BlzGetFrameByName("SimpleInfoPanelIconDamage", 1),
			// BlzGetFrameByName("SimpleInfoPanelIconArmor", 2),
			// BlzGetFrameByName("SimpleInfoPanelIconRank", 3),
			// BlzGetFrameByName("SimpleInfoPanelIconFood", 4),
			// BlzGetFrameByName("SimpleInfoPanelIconGold", 5),
			// BlzGetFrameByName("InfoPanelIconHeroIcon", 6),
			// BlzGetFrameByName("SimpleInfoPanelIconAlly", 7),

			// BlzGetFrameByName("InfoPanelIconHeroStrengthLabel", 6),
			// BlzGetFrameByName("InfoPanelIconHeroStrengthValue", 6),
			// BlzGetFrameByName("InfoPanelIconHeroAgilityLabel", 6),
			// BlzGetFrameByName("InfoPanelIconHeroAgilityValue", 6),
			// BlzGetFrameByName("InfoPanelIconHeroIntellectLabel", 6),
			// BlzGetFrameByName("InfoPanelIconHeroIntellectValue", 6),
			// BlzGetFrameByName("SimpleInfoPanelIconHeroText", 6),
			// BlzGetFrameByName("SimpleInfoPanelIconHero", 6),
			BlzGetFrameByName("SimpleInfoPanelUnitDetail", 0),
			BlzGetFrameByName("SimpleInventoryCover", 0),
			BlzGetFrameByName("SimpleInventoryCoverTexture", 0),
		]

		for (let i = 0; i < toBeHidden.length; ++i) {
			BJDebugMsg(i + ": " + toBeHidden[i]);
		}

		const player = GetTriggerPlayer();
		if (GetLocalPlayer() == player) {
			FrameHelper.setFramesVisibility(toBeHidden, false);
		}

  });
  


  // ==== other player related triggers ====
  // player leaves game
  const leaveTrig = CreateTrigger();
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerEvent(leaveTrig, Player(i), EVENT_PLAYER_LEAVE);
  }
  TriggerAddAction(leaveTrig, () => {
    const leavePlayer = GetTriggerPlayer();
    DisplayTimedTextToForce(
      GetPlayersAll(), 
      15,
      Colorizer.getColoredPlayerName(leavePlayer) + 
      " has left the game."
    );
  })

  // player kills another player
  const killTrig = CreateTrigger();
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerUnitEventSimple(killTrig, Player(i), EVENT_PLAYER_UNIT_DEATH);
  }
  TriggerRegisterPlayerUnitEventSimple(killTrig, Player(PLAYER_NEUTRAL_AGGRESSIVE), EVENT_PLAYER_UNIT_DEATH);
  TriggerAddCondition(killTrig, Condition( () => {
    return (
      IsUnitType(GetTriggerUnit(), UNIT_TYPE_HERO) && 
     !IsUnitType(GetTriggerUnit(), UNIT_TYPE_SUMMONED)
    );
  }));
  TriggerAddAction(killTrig, () => {
    const deadPlayer = GetOwningPlayer(GetDyingUnit());
    const deadPlayerId = GetPlayerId(deadPlayer);
    const killPlayer = GetOwningPlayer(GetKillingUnit());
    const killPlayerId = GetPlayerId(killPlayer);

    let killerName = Colorizer.getColoredPlayerName(killPlayer);
    let deadName = Colorizer.getColoredPlayerName(deadPlayer);
    if (
      (killPlayer == Player(PLAYER_NEUTRAL_AGGRESSIVE) || killPlayerId >= Constants.maxActivePlayers) && 
      IsUnitType(GetKillingUnit(), UNIT_TYPE_HERO)
    ) {
      killerName = Colorizer.getPlayerColorText(killPlayerId) + GetHeroProperName(GetKillingUnit()) + "|r";
    }

    if (
      (deadPlayer == Player(PLAYER_NEUTRAL_AGGRESSIVE) || deadPlayerId >= Constants.maxActivePlayers) && 
      IsUnitType(GetDyingUnit(), UNIT_TYPE_HERO)
    ) {
      deadName = Colorizer.getPlayerColorText(deadPlayerId) + GetHeroProperName(GetDyingUnit()) + "|r";
    }

    if (
      killerName && deadName && 
      GetPlayerName(killPlayer).length > 1 &&
      GetPlayerName(deadPlayer).length > 1 &&
      (
        killPlayerId == PLAYER_NEUTRAL_AGGRESSIVE || 
        (killPlayerId >= 0 && killPlayerId < Constants.maxPlayers)
      ) &&
      deadPlayerId != Constants.heavenHellCreepPlayerId
    ) {
      DisplayTimedTextToForce(
        GetPlayersAll(), 
        8,
        killerName + 
        " has killed " + 
        deadName
      );
    }

  })


  /*
  // revive heroes for free
  const revoiveSpam = CreateTrigger();
  TriggerRegisterAnyUnitEventBJ(revoiveSpam, EVENT_PLAYER_UNIT_DEATH);
  TriggerAddAction(revoiveSpam, () => {
    const dead = GetTriggerUnit();
    if (IsUnitType(dead, UNIT_TYPE_HERO) && !IsUnitType(dead, UNIT_TYPE_SUMMONED)) {
      TimerStart(CreateTimer(), 5.0, false, () => {
        const t = GetExpiredTimer();
        ReviveHero(dead, 64 + Math.random()*256, 64 + Math.random()*256, true);
        // BJDebugMsg("revoive spoim");
        SetUnitState(dead, UNIT_STATE_MANA, BlzGetUnitMaxMana(dead));
        SetUnitState(dead, UNIT_STATE_LIFE, BlzGetUnitMaxHP(dead));
        DestroyTimer(t);
      })
    }
  })
  */


  // special player commands + single player commands
  // force stats
  let numActivePlayers = 0;
  for (let i = 0; i < Constants.maxActivePlayers; ++i) {
    let player = Player(i);
    if (
      IsPlayerSlotState(player, PLAYER_SLOT_STATE_PLAYING) &&
      GetPlayerController(player) == MAP_CONTROL_USER && 
      GetPlayerController(player) != MAP_CONTROL_COMPUTER
    ) {
      ++numActivePlayers;
    }
  }

  BJDebugMsg("Num players detected: " + numActivePlayers);

  if (numActivePlayers == 1) {

    BJDebugMsg("Special Single Player Commands -lvl -mega -cd");

    const megaLvl = CreateTrigger();
    TriggerRegisterPlayerChatEvent(megaLvl, Player(0), "-mega", true);
    TriggerAddAction(megaLvl, () => {
      const group = GetUnitsOfPlayerMatching(
        GetTriggerPlayer(), 
        Condition(() => {
          return IsUnitType(GetFilterUnit(), UNIT_TYPE_HERO);
        })
      )

      ForGroup(group, () => {
        SetHeroLevel(GetEnumUnit(), 900, false);
        ModifyHeroSkillPoints(GetEnumUnit(), bj_MODIFYMETHOD_ADD, 500);
      });

      DestroyGroup(group);
    });

    const statsTrig = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(statsTrig, Player(i), "-stats", false);
    }
    TriggerAddAction(statsTrig, () => {
      const value = S2I(SubString(GetEventPlayerChatString(), 7, 12));
      const group = GetUnitsSelectedAll(GetTriggerPlayer());
      ForGroup(group, () => {
        const target = GetEnumUnit();
        if (IsUnitType(target, UNIT_TYPE_HERO)) {
          SetHeroStr(target, value, true);
          SetHeroAgi(target, value, true);
          SetHeroInt(target, value, true);
        }
      });
      DestroyGroup(group);
    });
  
    const lvlTrig = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(lvlTrig, Player(i), "-lvl", false);
    }
    TriggerAddAction(lvlTrig, () => {
      const value = S2I(SubString(GetEventPlayerChatString(), 5, 8));
      const group = GetUnitsSelectedAll(GetTriggerPlayer());
      ForGroup(group, () => {
        const target = GetEnumUnit();
        if (IsUnitType(target, UNIT_TYPE_HERO)) {
          SetHeroLevel(target, value, false);
        }
      });
      DestroyGroup(group);
    });

    const xpRate = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(xpRate, Player(i), "-xpr", false);
    }
    TriggerAddAction(xpRate, () => {
      const value = S2R(SubString(GetEventPlayerChatString(), 5, 9));
      SetPlayerHandicapXP(GetTriggerPlayer(), value * 0.01);
      BJDebugMsg("XP Rate: " + GetPlayerHandicapXPBJ(GetTriggerPlayer()));
    });
  
    // reset cd of custom ability
    const cdTrig = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(cdTrig, Player(i), "-cd", true);
    }
    TriggerAddAction(cdTrig, () => {
      const player = GetTriggerPlayer();
      const playerId = GetPlayerId(player);
      for (const customHero of customPlayers[playerId].allHeroes) {
        if (customHero) {
          UnitResetCooldown(customHero.unit);
          for (const [name, abil] of customHero.abilities.abilities) {
            if (abil) {
              abil.currentCd = 0;
            }
          }
        }
      }
    });

    const tpTrig = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerUnitEventSimple(tpTrig, Player(i), EVENT_PLAYER_UNIT_ISSUED_POINT_ORDER);
    };
    TriggerAddCondition(tpTrig, Condition(()=>{
      return GetIssuedOrderId() == String2OrderIdBJ("patrol");
    }));
    TriggerAddAction(tpTrig, () => {
      const unit = GetTriggerUnit();
      SetUnitX(unit, GetOrderPointX());
      SetUnitY(unit, GetOrderPointY());
    });

    // reveal map
    /*
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      FogModifierStart(CreateFogModifierRect(Player(i), FOG_OF_WAR_VISIBLE, GetPlayableMapRect(), true, false));
    }
    */
    // SetPlayerAllianceStateBJ(Player(PLAYER_NEUTRAL_AGGRESSIVE), udg_TempPlayer, bj_ALLIANCE_ALLIED_VISION)
  
    // force budokai
    const forceBudokaiTrig = CreateTrigger();
    TriggerRegisterPlayerChatEvent(forceBudokaiTrig, Player(0), "-forcebudokaitest", true);
    TriggerAddAction(forceBudokaiTrig, () => {
      TournamentManager.getInstance().startTournament(Constants.budokaiName);
    });

    // force set unit skin
    const setUnitSkin = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(setUnitSkin, Player(i), "-skin", false);
    };
    TriggerAddAction(setUnitSkin, () => {
      const value = FourCC(SubString(GetEventPlayerChatString(), 6, 9));
      const group = GetUnitsSelectedAll(GetTriggerPlayer());
      ForGroup(group, () => {
        const target = GetEnumUnit();
        BlzSetUnitSkin(target, value);
      });
      DestroyGroup(group);
    });

    const makeItem = CreateTrigger();
    for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
      TriggerRegisterPlayerChatEvent(makeItem, Player(i), "-item", false);
    };
    TriggerAddAction(makeItem, () => {
      const value = FourCC(SubString(GetEventPlayerChatString(), 6, 9));
      const group = GetUnitsSelectedAll(GetTriggerPlayer());
      ForGroup(group, () => {
        const target = GetEnumUnit();
        CreateItem(value, GetUnitX(target), GetUnitY(target));
      });
      DestroyGroup(group);
    });
  }

  // ally/unally as necessary
  const allyTrig = CreateTrigger();
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerChatEvent(allyTrig, Player(i), "-ally", false);
  }
  TriggerAddAction(allyTrig, () => {
    const player = GetTriggerPlayer();
    const targetPlayerId = S2I(SubString(GetEventPlayerChatString(), 6, 7));
    SetPlayerAllianceStateBJ(player, Player(targetPlayerId), bj_ALLIANCE_ALLIED_VISION);
  });

  const unallyTrig = CreateTrigger();
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerChatEvent(unallyTrig, Player(i), "-unally", false);
  }
  TriggerAddAction(unallyTrig, () => {
    const player = GetTriggerPlayer();
    const targetPlayerId = S2I(SubString(GetEventPlayerChatString(), 8, 9));
    SetPlayerAllianceStateBJ(player, Player(targetPlayerId), bj_ALLIANCE_UNALLIED);
  });

  // rename trig
  const nameTrig = CreateTrigger();
  for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
    TriggerRegisterPlayerChatEvent(nameTrig, Player(i), "-name", false);
  }
  TriggerAddAction(nameTrig, () => {
    const player = GetTriggerPlayer();
    const newName = SubString(GetEventPlayerChatString(), 6, 20);
    if (newName.length > 1) {
      SetPlayerName(player, newName);
    }
  });

  // freemode
  const freeModeTrig = CreateTrigger();
  // for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
  //   TriggerRegisterPlayerChatEvent(nameTrig, Player(i), "-name", false);
  // }
  TriggerRegisterPlayerChatEvent(freeModeTrig, Player(0), "-freemode", true);
  TriggerAddAction(freeModeTrig, () => {
    WinLossHelper.freeMode = true;
  });

  // force final battle
  const forceFinalBattleTrig = CreateTrigger();
  TriggerRegisterPlayerChatEvent(forceFinalBattleTrig, Player(0), "-forcefinalbattletest", true);
  TriggerAddAction(forceFinalBattleTrig, () => {
    TournamentManager.getInstance().startTournament(Constants.finalBattleName);
  });


  
  // allow player to modify ui as they see fit
	// prints id of frame given by name
	const customUIPlayerSelectFrame = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(customUIPlayerSelectFrame, Player(i), "uipr", false);
	}
	TriggerAddAction(customUIPlayerSelectFrame, () => {
		FrameHelper.getFrameFromString(GetEventPlayerChatString(), 5, true);
	});

	// toggle ui on/off
	const customUIPlayerToggleFrame = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(customUIPlayerToggleFrame, Player(i), "uion", false);
		TriggerRegisterPlayerChatEvent(customUIPlayerToggleFrame, Player(i), "uiof", false);
	}
	TriggerAddAction(customUIPlayerToggleFrame, () => {
    const player = GetTriggerPlayer();
    const input = GetEventPlayerChatString();
		const frame = FrameHelper.getFrameFromString(input, 5, true);
		if (GetLocalPlayer() == player && frame) {
      if (input[3] == 'n') {
        BlzFrameSetEnable(frame, true);
      } else {
        BlzFrameSetEnable(frame, false);
      }
		}
	});

	// uimv x.xxx y.yyy cc name
	const customUIPlayerMoveFrame = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(customUIPlayerMoveFrame, Player(i), "uimv", false);
	}
	TriggerAddAction(customUIPlayerMoveFrame, () => {
		const player = GetTriggerPlayer();
		const input = GetEventPlayerChatString();
		const x = S2R(input.substring(5, 10));
		const y = S2R(input.substring(11, 16));
		const frame = FrameHelper.getFrameFromString(input, 17, true);
		if (GetLocalPlayer() == player && frame) {
      BlzFrameClearAllPoints(frame);
			BlzFrameSetAbsPoint(frame, FRAMEPOINT_CENTER, x, y);
		}
  });

	// uirs x.xxx y.yyy cc name
	const customUIPlayerResizeFrame = CreateTrigger();
	for (let i = 0; i < bj_MAX_PLAYERS; ++i) {
		TriggerRegisterPlayerChatEvent(customUIPlayerResizeFrame, Player(i), "uirs", false);
	}
	TriggerAddAction(customUIPlayerResizeFrame, () => {
		const player = GetTriggerPlayer();
		const input = GetEventPlayerChatString();
		const x = S2R(input.substring(5, 10));
		const y = S2R(input.substring(11, 16));
		const frame = FrameHelper.getFrameFromString(input, 17, true);
		if (GetLocalPlayer() == player && frame) {
      BlzFrameSetSize(frame, x, y);
		}
  });
}