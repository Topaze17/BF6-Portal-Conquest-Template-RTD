import { Events } from 'bf6-portal-utils/events/index.ts';
import { MultiClickDetector } from 'bf6-portal-utils/multi-click-detector/index.ts';
import { MapDetector } from 'bf6-portal-utils/map-detector/index.ts';
import { UI } from 'bf6-portal-utils/ui'
import { DebugTool } from './debug-tool/index.ts';
import  { Sounds } from 'bf6-portal-utils/sounds'
import { UIContainer } from 'bf6-portal-utils/ui/components/container/index.ts';
import { UIText } from 'bf6-portal-utils/ui/components/text'
import { DefaultMap } from './helpers/index.ts';
import { Timers } from 'bf6-portal-utils/timers';






// ------START : Variable to play with------//
//score
const startScoreNato = 300
const startScorePax = 300
const ticketLostPerKill = 1
//bleedTimer (seconds)
const bleedTime50Percent = 5
const bleedTime75Percent = 2.5
const bleedTime100Percent = 1
//capturePoint (seconds)
const captureTime = 15
const neutralizationTime = 15
const maxMultiplier = 2
//----------END : Variable to play with-------------//







let adminDebugTool: DebugTool | undefined;


function createAdminDebugTool(player: mod.Player): void {
    // The admin player is player id 0 for non-persistent test servers,
    // so don't do the rest of this unless it's the admin player.
    if (mod.GetObjId(player) != 0) return;

    // Create a debug tool with a static logger visible by default.
    const debugToolOptions: DebugTool.Options = {
        staticLogger: {
            visible: true,
        },
        dynamicLogger: {
            visible: false,
        },
        debugMenu: {
            visible: false,
        },
    };

    adminDebugTool = new DebugTool(player, debugToolOptions);

    // Create a multi-click detector to open the debug menu when the player triple-clicks the interact key.
    new MultiClickDetector(player, () => {
        adminDebugTool?.showDebugMenu();
    });

    // Log a message to the static logger.
    adminDebugTool?.staticLog(`Triple-click interact key to open debug menu.`, 0);
}

function destroyAdminDebugTool(playerId: number): void {
    // If the player is not the admin player, then we know the admin is still in the game, so we can exit this function.
    if (playerId !== 0) return;

    // Destroy the debug tool.
    adminDebugTool?.destroy();
    adminDebugTool = undefined;
}

function handlePlayerDeployed(player: mod.Player): void {
    // Log a message to the dynamic logger that the player has deployed.
    adminDebugTool?.dynamicLog(`Player ${mod.GetObjId(player)} deployed.`);
}

// Event subscriptions for the admin debug tool.
Events.OnPlayerJoinGame.subscribe(createAdminDebugTool);
Events.OnPlayerLeaveGame.subscribe(destroyAdminDebugTool);

// Event subscriptions for notifying players of their name and the current map.
Events.OnPlayerDeployed.subscribe(handlePlayerDeployed);


Events.OnGameModeStarted.subscribe(Setup)
Events.OnCapturePointCaptured.subscribe(changeOwnerProgressTean)
Events.OnCapturePointLost.subscribe((cp) => ChangeFlagOwner(cp ,false))
Events.OnCapturePointCaptured.subscribe((cp) => ChangeFlagOwner(cp, true))
Events.OnPlayerExitCapturePoint.subscribe(RemovePlayerFromFlag)
Events.OnPlayerEnterCapturePoint.subscribe(AddPlayerOnCapturePoint)
Events.OngoingCapturePoint.subscribe(CapturePointLoop)
Events.OnPlayerJoinGame.subscribe(SetupPersonalUiElement)
Events.OnPlayerDeployed.subscribe(SwitchTeam)
Events.OnPlayerUndeploy.subscribe(RemoveIsOnFlag)
Events.OnPlayerLeaveGame.subscribe(CleanupOnLeave)
Events.OnPlayerDied.subscribe(CleanupOnDied)
Events.OnRevived.subscribe(RefreshOnRevive)
Events.OnPlayerEarnedKill.subscribe(OnPlayerEarnedKillScoreChange)
Events.OngoingGlobal.subscribe(mainLoop)




//Enum
enum Team {
    Neutral,
    Nato,
    Pax
}
//usefull const for flag ui widget
const colorAlpha = 0.8
const insideAlpha = 0.9

//Color Vector
const blueColor = mod.CreateVector(0.439, 0.922, 1)
const darkBlueColor = mod.CreateVector(0.075, 0.184, 0.247)
const grayColor = mod.CreateVector(0.212, 0.224, 0.235)
const redColor = mod.CreateVector(1, 0.514, 0.38)
const darkRedColor = mod.CreateVector(0.251, 0.094, 0.067)
const blackColor = mod.CreateVector(0.031, 0.031, 0.031)
const whiteColor = mod.CreateVector(1,1,1)

//Global Variable
let isGameModeReady = false
let isFlagBlinking = new Array<boolean>()
let timer = 0

let nbFlags = 0
const capturePointSound = mod.GlobalVariable(13)
let bleedTimerTeam = Team.Neutral

//PerObjectVariable
//CapturePoint
const flagOwner = new DefaultMap<number, number>(() => 0);
const natoPlayersOnCapturePoint = new DefaultMap<number, Array<mod.Player>>(() => []);
const paxPlayersOnCapturePoint = new DefaultMap<number, Array<mod.Player>>(() => []);
const teamCapturingCapturePoint=  new DefaultMap<number, number>(() => 0);
const oldCaptureStepCapturePoint =  new DefaultMap<number, number>(() => 0);
const capturePointProgressMovement =  new DefaultMap<number, boolean>(() => false);
const capturePointProgressDirection =  new DefaultMap<number, number>(() => 0);
//Player
const onFlagPlayerWidgets =  new DefaultMap<number, Array<UI.Element>>(() => []);
const playerUiAnchor = new Map<number, UI.Element>();

const playerIsOnFlag = new DefaultMap<number, number>(() => -1);


//Team
const teamUiAnchors = new Map<number, UI.Element>();
const teamFlags = new DefaultMap<number, number>(() => 0);
const teamFlagsUi = new DefaultMap<number, Array<UI.Element>>(() => []);
const teamScore = new DefaultMap<number, number>(() => 0);
const teamScoreUi = new DefaultMap<number, Array<UI.Element>>(() => []);

//Offset
let neutralUiSection = 0
let allyUiSection = 0
let enemyUISection = 0
const idOffsetOfFlag = 200
//
//Setup
function Setup(): void {
    const numberOfFlag = mod.CountOf(mod.AllCapturePoints())
    teamScore.set(Team.Nato, startScoreNato) 
    teamScore.set(Team.Pax, startScorePax) 
    mod.LoadMusic(mod.MusicPackages.Core)
    nbFlags = numberOfFlag;
    neutralUiSection = 0
    allyUiSection = nbFlags
    enemyUISection = nbFlags * 2
    for(let x = 0; x < numberOfFlag; x += 1) {
            isFlagBlinking.push(false)
    }
    teamFlags.set(Team.Nato, 0)
    teamFlags.set(Team.Pax, 0)
    MakeUiTeamAnchor()
    MakeScoreUi()
    MakeFlagUiLayer(numberOfFlag)
    SetupFlagAudio()
    mod.EnableGameModeObjective(mod.GetSector(300), true)
    for(let x = 0; x < mod.CountOf(mod.AllCapturePoints()); x += 1) {
        const capturePoint = mod.ValueInArray(mod.AllCapturePoints(), x)  
        const capturePointId = mod.GetObjId(capturePoint)
        const teamFlagOwner = mod.GetObjId(mod.GetCurrentOwnerTeam(capturePoint))
        flagOwner.set(mod.GetObjId(capturePoint), Team.Neutral)
        natoPlayersOnCapturePoint.set(capturePointId, [])
        paxPlayersOnCapturePoint.set(capturePointId, [])
        mod.EnableGameModeObjective(capturePoint, true)
        mod.EnableCapturePointDeploying(capturePoint, true)
        mod.SetCapturePointCapturingTime(capturePoint, captureTime)
        mod.SetCapturePointNeutralizationTime(capturePoint, neutralizationTime)
        mod.SetMaxCaptureMultiplier(capturePoint, maxMultiplier)
        teamCapturingCapturePoint.set(capturePointId, teamFlagOwner)
        oldCaptureStepCapturePoint.set(capturePointId, mod.GetCaptureProgress(capturePoint))
        capturePointProgressMovement.set(capturePointId, false)
        capturePointProgressDirection.set(capturePointId, Team.Neutral)
        SetFlagOwner(x, teamFlagOwner)
        SoundOnFlag(capturePoint)
    }
    
    Timers.setInterval(() => {timer += 0.05}, 50, true);
    Timers.setInterval(Blink, 150, false)
    BleedTimer()
    isGameModeReady = true
}
//------Capture Point Function------//
function changeOwnerProgressTean(eventCapturePoint: mod.CapturePoint): void {
   teamCapturingCapturePoint.set(mod.GetObjId(eventCapturePoint), mod.GetObjId(mod.GetOwnerProgressTeam(eventCapturePoint)))
 }
function ChangeFlagOwner(eventCapturePoint: mod.CapturePoint, captured: boolean): void {
    if (!isGameModeReady) return
    const flag = mod.GetObjId(eventCapturePoint) - idOffsetOfFlag
    SetFlagOwner(flag, mod.GetObjId(mod.GetCurrentOwnerTeam(eventCapturePoint)))
    if(captured) {
        SetFlagBlink(flag, false);
    }
    NotifyOnFlagPlayersOfStateChange(eventCapturePoint)
}
function RemovePlayerFromFlag(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint, byPassDownCheck: boolean = false): void {
    const playerId = mod.GetObjId(eventPlayer)
    if(playerIsOnFlag.get(playerId) == -1) return
    playerIsOnFlag.set(playerId, -1)
    if (mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsManDown) && !byPassDownCheck) return
    const capturePointId = mod.GetObjId(eventCapturePoint)
    const soundArray = mod.GetVariable(capturePointSound)
    const tickEnemySfx = mod.ValueInArray(soundArray, 1)
    const contestSfx = mod.ValueInArray(soundArray, 2)
    mod.StopSound(tickEnemySfx, eventPlayer)
    mod.StopSound(contestSfx, eventPlayer)
    removeFromViewOnFlagLayer(eventPlayer)
    if(mod.GetObjId(mod.GetTeam(eventPlayer)) == Team.Nato) {
        natoPlayersOnCapturePoint.get(capturePointId).splice(natoPlayersOnCapturePoint.get(capturePointId).findIndex((player) => mod.GetObjId(player) == playerId), 1)
    }
    else {
        paxPlayersOnCapturePoint.get(capturePointId).splice(paxPlayersOnCapturePoint.get(capturePointId).findIndex((player) => mod.GetObjId(player) == playerId), 1)
    }
    NotifyFlagOfPopulationChange(eventCapturePoint)
}

export async function CapturePointLoop(eventCapturePoint: mod.CapturePoint): Promise<void> {
    const capturePointId = mod.GetObjId(eventCapturePoint)
    const oldCaptureStep = oldCaptureStepCapturePoint.get(capturePointId)
    const newCaptureState = mod.GetCaptureProgress(eventCapturePoint)
    if(oldCaptureStep != newCaptureState) {
        oldCaptureStepCapturePoint.set(capturePointId, newCaptureState)
        capturePointProgressMovement.set(capturePointId, true)
        NotifyPlayerUiOfFlagCaptureState(eventCapturePoint)
    }
    else {
        capturePointProgressMovement.set(capturePointId, false)
    }
    await mod.Wait(0.1)
}
export function AddPlayerOnCapturePoint(eventPlayer: mod.Player, eventCapturePoint: mod.CapturePoint, byPassDownCheck: boolean = false): void {
    const capturePointId = mod.GetObjId(eventCapturePoint)
    const flag = capturePointId - idOffsetOfFlag
    playerIsOnFlag.set(mod.GetObjId(eventPlayer), flag)
    if (!mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsAlive) && !byPassDownCheck) return 
    if(mod.GetObjId(mod.GetTeam(eventPlayer)) == Team.Nato) {
        natoPlayersOnCapturePoint.get(capturePointId).push(eventPlayer)
    }
    else {
        paxPlayersOnCapturePoint.get(capturePointId).push(eventPlayer)
    }
    NotifyFlagOfPopulationChange(eventCapturePoint)
    NotifyPlayersOfPopulationChangeOnFlag(eventCapturePoint)
    DisplayOnFlagLayer(eventPlayer, flag)

}
//------Player Function--------//
function SetupPersonalUiElement(eventPlayer: mod.Player): void {
    playerIsOnFlag.set(mod.GetObjId(eventPlayer), -1)
    MakeUiAnchorPlayer(eventPlayer)
    MakeOnFlagUiLayer(eventPlayer)
}
function SwitchTeam(eventPlayer: mod.Player): void {
    if(mod.IsSoldierClass(eventPlayer, mod.SoldierClass.Recon)) {
        mod.SetTeam(eventPlayer, mod.GetTeam(Team.Pax))
    }
}
function RemoveIsOnFlag(eventPlayer: mod.Player): void {
    playerIsOnFlag.set(mod.GetObjId(eventPlayer), -1)
}
function CleanupOnLeave(eventNumber: number): void {
    if(!isGameModeReady) return
    RemoveInvalidPlayerFromFlag()
}
function CleanupOnDied(eventPlayer: mod.Player,eventOtherPlayer: mod.Player,eventDeathType: mod.DeathType,eventWeaponUnlock: mod.WeaponUnlock): void {
    const playerId = mod.GetObjId(eventPlayer)
    const playerFlag = playerIsOnFlag.get(playerId)
    if(playerFlag != -1) {
        RemovePlayerFromFlag(eventPlayer, mod.ValueInArray(mod.AllCapturePoints(), playerFlag), true)
        if(mod.GetSoldierState(eventPlayer, mod.SoldierStateBool.IsManDown)) {
            playerIsOnFlag.set(playerId, playerFlag)
        }
    }
}
function RefreshOnRevive(eventPlayer: mod.Player, eventOtherPlayer: mod.Player): void {
    const playerId = mod.GetObjId(eventPlayer)
    const playerFlag = playerIsOnFlag.get(playerId)
    if(playerFlag != -1) {
        AddPlayerOnCapturePoint(eventPlayer, mod.ValueInArray(mod.AllCapturePoints(), playerFlag), true)
    }
}

function OnPlayerEarnedKillScoreChange( eventPlayer: mod.Player,eventOtherPlayer: mod.Player,eventDeathType: mod.DeathType,eventWeaponUnlock: mod.WeaponUnlock): void {
    if(mod.GetObjId(eventPlayer) != mod.GetObjId(eventOtherPlayer)) {
        AddToScore(-ticketLostPerKill, mod.GetObjId(mod.GetTeam(eventOtherPlayer)))
    }
}
//-----MAIN LOOP ------//
async function mainLoop(): Promise<void> {
}
//-----OTHER LOOP----//
//May be reworked in a later day
async function BleedTimer() {
    const majority1 = mod.Floor(nbFlags - (nbFlags / 4))
    while(true) {
        const bleedTimerTeamV = bleedTimerTeam
        const bleedTimerTeamNbFlag = teamFlags.get(bleedTimerTeam)
        
        if(bleedTimerTeamV == Team.Neutral) {
            await mod.Wait(0.5)
        }
        else {
            if(bleedTimerTeamNbFlag == nbFlags) {
                await mod.Wait(bleedTime100Percent)
            }
            else if(bleedTimerTeamNbFlag > majority1) {
                await mod.Wait(bleedTime75Percent)
            }
            else {
                await mod.Wait(bleedTime50Percent)
            }
            if(bleedTimerTeamV == bleedTimerTeam) {
                const teamBleeding = bleedTimerTeamV == Team.Nato ? Team.Pax : Team.Nato 
                AddToScore(-1, teamBleeding)
            }
        }
    }
}
//HARD LIMIT 9 FLAG BLINKING AT THE SAME TIME START LAG (Only on the UI) (Since optimized and limit not checked)
function Blink() {
        const natoFlagsWidgets = teamFlagsUi.get(Team.Nato)
        const paxFlagsWidgets = teamFlagsUi.get(Team.Pax)
        const sin = mod.SineFromRadians(mod.Multiply(timer , 2))
        const outlineAlpha = mod.Add(0.55, mod.Multiply(sin, 0.25));
        const insideCalcAlpha = mod.Add(0.6, mod.Multiply(sin, 0.3));
        for(let x = 0 ; x < nbFlags; x += 1) {
            if(isFlagBlinking[x]) {
                const owner = flagOwner.get(x + idOffsetOfFlag)
                let paxLayerUpdate = neutralUiSection
                let natoLayerUpdate = neutralUiSection
                if(owner == Team.Pax) {
                    paxLayerUpdate = allyUiSection
                    natoLayerUpdate = enemyUISection
                }
                else if(owner == Team.Nato) {
                    paxLayerUpdate = enemyUISection
                    natoLayerUpdate = allyUiSection
                }
                (paxFlagsWidgets[paxLayerUpdate + x] as UIContainer).children.forEach((widget, index) => ApplyAlphaFunction(widget, index == 1 ? insideCalcAlpha : outlineAlpha));
                (natoFlagsWidgets[natoLayerUpdate + x] as UIContainer).children.forEach((widget, index) => ApplyAlphaFunction(widget, index == 1 ? insideCalcAlpha : outlineAlpha));
            }
        }  
}
async function SoundOnFlag(capturePoint: mod.CapturePoint) {
    const idCapturePoint = mod.GetObjId(capturePoint)
    const soundArray = mod.GetVariable(capturePointSound);
    const tickAllySfx = mod.ValueInArray(soundArray, 0)
    const tickEnemySfx = mod.ValueInArray(soundArray, 1)
    const contestSfx = mod.ValueInArray(soundArray, 2)
    let wasContested = false
    let paxTeamWasCapturing = false
    let natoTeamWasCapturing = false
    let x = 0
    while(true) {
        let capturePointProgress = mod.GetCaptureProgress(capturePoint)
        const currentDirection = capturePointProgressDirection.get(idCapturePoint)
        const isMoving = capturePointProgressMovement.get(idCapturePoint)
        const natoPlayers = natoPlayersOnCapturePoint.get(idCapturePoint)
        const paxPlayers = paxPlayersOnCapturePoint.get(idCapturePoint)
        
        if(isMoving) {
            if(currentDirection == Team.Nato) {
                if(paxTeamWasCapturing) {
                    natoPlayers.forEach((player) => mod.StopSound(tickEnemySfx, player))
                }
                else if(wasContested) {
                    wasContested = false
                    natoPlayers.forEach((player) => mod.StopSound(contestSfx, player))
                    paxPlayers.forEach((player) => mod.StopSound(contestSfx, player))
                }
            
                natoPlayers.forEach((player) => mod.PlaySound(tickAllySfx,  x % 2 == 0 ? capturePointProgress : (capturePointProgress  / 2), player))
                
                if(!natoTeamWasCapturing) {
                    paxPlayers.forEach((player) => mod.PlaySound(tickEnemySfx, 1, player))
                    natoTeamWasCapturing = true
                }
            }
            else if(currentDirection == Team.Pax) {
                if(natoTeamWasCapturing) {
                    natoTeamWasCapturing = false
                    paxPlayers.forEach((player) => mod.StopSound(tickEnemySfx, player))
                }
                else if(wasContested) {
                    wasContested = false
                    natoPlayers.forEach((player) => mod.StopSound(contestSfx, player))
                    paxPlayers.forEach((player) => mod.StopSound(contestSfx, player))
                }
                
                paxPlayers.forEach((player) => mod.PlaySound(tickAllySfx, x % 2 == 0 ? capturePointProgress : (capturePointProgress  / 2), player))
                if(!paxTeamWasCapturing) {
                    natoPlayers.forEach((player) => mod.PlaySound(tickEnemySfx, 1, player))
                    paxTeamWasCapturing = true
                }
            }
        }
        else {
            if(capturePointProgress != 0 && capturePointProgress != 1) {
                if(natoTeamWasCapturing) {
                    natoTeamWasCapturing = false
                    paxPlayers.forEach((player) => mod.StopSound(tickEnemySfx, player))
                }
                else if(paxTeamWasCapturing) {
                    paxTeamWasCapturing = false
                    natoPlayers.forEach((player) => mod.StopSound(tickEnemySfx, player))
                }
                
                paxTeamWasCapturing = false
                if(!wasContested) {
                    natoPlayers.forEach((player) => mod.PlaySound(contestSfx, 1, player))
                    paxPlayers.forEach((player) => mod.PlaySound(contestSfx, 1, player))
                    wasContested = true
                }
            }
        }
        x += 1
        await mod.Wait(0.4)
    } 
}
// ----NOTIFY FUNCTION---//
function NotifyOnFlagPlayersOfStateChange(capturePoint : mod.CapturePoint) {
    const capturePointId = mod.GetObjId(capturePoint)
    const flag = capturePointId - idOffsetOfFlag
    const owner = flagOwner.get(capturePointId)
    const captureAudio = mod.ValueInArray(mod.GetVariable(capturePointSound), 5)
    const neutralizeAudio = mod.ValueInArray(mod.GetVariable(capturePointSound), 6)
    const natoPlayers = natoPlayersOnCapturePoint.get(capturePointId)
    const paxPlayers = paxPlayersOnCapturePoint.get(capturePointId)
    const nbPaxPlayers = paxPlayers.length
    const nbNatoPlayers = natoPlayers.length
    const notifyFunction = (team: Team, player : mod.Player) => {
        if(mod.Not(mod.GetSoldierState(player, mod.SoldierStateBool.IsManDown))) {
            DisplayOnFlagLayer(player, flag)
            UpdatePlayerOnFlagLayer(player, nbPaxPlayers, nbNatoPlayers, flag)
            if(owner == team) {
                mod.PlaySound(captureAudio, 1, player)
            }
            else if(owner == Team.Neutral) {
                mod.PlaySound(neutralizeAudio, 1, player)
            }
        }
    }
    natoPlayers.forEach((player) => notifyFunction(Team.Nato, player))
    paxPlayers.forEach((player) => notifyFunction(Team.Pax, player))
}
function NotifyPlayerUiOfFlagCaptureState(capturePoint : mod.CapturePoint) {
    const capturePointId = mod.GetObjId(capturePoint)
    const flag = capturePointId - idOffsetOfFlag
    const capturePointOwner = flagOwner.get(capturePointId)
    const capturePointPlayersArrayNato = natoPlayersOnCapturePoint.get(capturePointId)
    const capturePointPlayersArrayPax = paxPlayersOnCapturePoint.get(capturePointId)
    const captureProgress = oldCaptureStepCapturePoint.get(capturePointId)
    let layerPax = 0
    let layerNato = 0
    if(capturePointOwner == Team.Neutral) {
        layerNato = 1
        layerPax = 1
    }
    else if(capturePointOwner == Team.Nato) {
        layerNato = 0
        layerPax = 2
    }
    else {
        layerNato = 2
        layerPax = 0
    }
    capturePointPlayersArrayNato.forEach((player) => updateOnFlagLayerCaptureProgress(player, captureProgress, layerNato))
    capturePointPlayersArrayPax.forEach((player) => updateOnFlagLayerCaptureProgress(player, captureProgress, layerPax))
    

}
function NotifyFlagOfPopulationChange(capturePoint : mod.CapturePoint) {
    const capturePointId = mod.GetObjId(capturePoint)
    const flag = capturePointId - idOffsetOfFlag
    const capturePointOwner = flagOwner.get(capturePointId)
    const nbNatoPlayers = natoPlayersOnCapturePoint.get(capturePointId).length
    const nbPaxPlayers = paxPlayersOnCapturePoint.get(capturePointId).length
    if(isFlagBlinking[flag]) {
        if(capturePointOwner == Team.Nato &&  nbPaxPlayers == 0) {
            SetFlagBlink(flag, false)
        }
        else if(capturePointOwner == Team.Pax &&  nbNatoPlayers == 0) {
            SetFlagBlink(flag, false)
        }
        else if(nbNatoPlayers == 0 && nbPaxPlayers == 0){
            SetFlagBlink(flag, false)
        }
    }
    else {
        if(capturePointOwner == Team.Nato &&  nbPaxPlayers != 0) {
            SetFlagBlink(flag, true)
        }
        else if(capturePointOwner == Team.Pax &&  nbNatoPlayers != 0) {
            SetFlagBlink(flag, true)
        }
        else if(capturePointOwner == Team.Neutral && (nbNatoPlayers != 0 || nbPaxPlayers != 0)){
            SetFlagBlink(flag, true)
        }
    }
    if(nbNatoPlayers > nbPaxPlayers) {
        capturePointProgressDirection.set(capturePointId, Team.Nato)
    }
    else if(nbPaxPlayers > nbNatoPlayers) {
        capturePointProgressDirection.set(capturePointId, Team.Pax)
    }
    else {
        capturePointProgressDirection.set(capturePointId, Team.Neutral)
    }
    NotifyPlayersOfPopulationChangeOnFlag(capturePoint)
}
function NotifyPlayersOfPopulationChangeOnFlag(capturePoint: mod.CapturePoint) {
    const capturePointId = mod.GetObjId(capturePoint)
    const flag = capturePointId - idOffsetOfFlag
    const natoPlayers = natoPlayersOnCapturePoint.get(capturePointId)
    const paxPlayers = paxPlayersOnCapturePoint.get(capturePointId)
    natoPlayers.forEach((player) => UpdatePlayerOnFlagLayer(player, paxPlayers.length , natoPlayers.length , flag))
    paxPlayers.forEach((player) => UpdatePlayerOnFlagLayer(player, paxPlayers.length , natoPlayers.length , flag))
}

//-----SET FUNCTION----//
//Make asumption that you do not change to the same team
function SetFlagOwner(flag: number, team : number) {
    const oldFlagOwner = flagOwner.get(flag + idOffsetOfFlag)
    const natoFlagsWidgets = teamFlagsUi.get(Team.Nato);
    const paxFlagsWidgets = teamFlagsUi.get(Team.Pax);
    const natoFlagsNeutralWidgets = natoFlagsWidgets.slice(neutralUiSection, allyUiSection);
    const paxFlagsNeutralWidgets = paxFlagsWidgets.slice(neutralUiSection, allyUiSection);
    const natoFlagsAllyWidgets = natoFlagsWidgets.slice(allyUiSection, enemyUISection)
    const paxFlagsAllyWidgets = paxFlagsWidgets.slice(allyUiSection, enemyUISection)
    const natoFlagsEnemyWidgets = natoFlagsWidgets.slice(enemyUISection)
    const paxFlagsEnemyWidgets = paxFlagsWidgets.slice(enemyUISection)

    const updateWidget = (widget: UI.Element, isVisible: boolean) => 
        isVisible ? widget.show() : widget.hide();

    updateWidget(natoFlagsNeutralWidgets[flag], team === Team.Neutral);
    updateWidget(paxFlagsNeutralWidgets[flag], team === Team.Neutral);

    updateWidget(natoFlagsAllyWidgets[flag], team === Team.Nato);
    updateWidget(paxFlagsEnemyWidgets[flag], team === Team.Nato);

    updateWidget(paxFlagsAllyWidgets[flag], team === Team.Pax);
    updateWidget(natoFlagsEnemyWidgets[flag], team === Team.Pax);
    if(oldFlagOwner == Team.Neutral) {
        teamFlags.set(team, teamFlags.get(team) + 1)
    }
    else{
        teamFlags.set(oldFlagOwner, teamFlags.get(oldFlagOwner) - 1)
    }
    const majority = mod.Floor(nbFlags / 2)
    flagOwner.set(flag + idOffsetOfFlag, team)
    const nbPaxFlags = teamFlags.get(Team.Pax)
    const nbNatoFlags = teamFlags.get(Team.Nato)
    if(nbNatoFlags > majority) {
        bleedTimerTeam = Team.Nato
    }
    else if(nbPaxFlags > majority) {
        bleedTimerTeam = Team.Pax
    }
    else {
        bleedTimerTeam = Team.Neutral
    }
    if(isFlagBlinking[flag]) {
        SetFlagBlink(flag, false)
        SetFlagBlink(flag, true)
    }
}
function SetFlagBlink(flag : number, bool: boolean) {
    if(bool) {
       isFlagBlinking[flag] = true
    }
    else {
            const natoFlagsWidgets = teamFlagsUi.get(Team.Nato)
            const paxFlagsWidgets = teamFlagsUi.get(Team.Pax)
            const owner = flagOwner.get(flag + idOffsetOfFlag)
            let paxLayerUpdate = neutralUiSection
            let natoLayerUpdate = neutralUiSection
           
            if(owner == Team.Pax) {
                paxLayerUpdate = allyUiSection
                natoLayerUpdate = enemyUISection;
            }
            else if(owner == Team.Nato) {
                paxLayerUpdate = enemyUISection
                natoLayerUpdate = allyUiSection
            }
            (paxFlagsWidgets[paxLayerUpdate + flag] as UIContainer).children.forEach((widget, index) => ApplyAlphaFunction(widget, index == 1 ? insideAlpha : colorAlpha));
            (natoFlagsWidgets[natoLayerUpdate + flag] as UIContainer).children.forEach((widget, index) => ApplyAlphaFunction(widget, index == 1 ? insideAlpha : colorAlpha));
            isFlagBlinking[flag] = false
        }
}
function SetupFlagAudio() {
    const onNeutralize = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Notification_ObjectiveSecured_FillIn_Neutral_OneShot2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const onCaptureByAlly = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Notification_ObjectiveSecured_FillIn_Positive_OneShot2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const onExist = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_ObjectiveOnExit_OneShot2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const onEnter = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_ObjectiveOnEnter_OneShot2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const onContestedLoop = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_OnContested_SimpleLoop2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const tickAlly = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTickIcon_IsFriendly_OneShot2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    const tickEnemyLoop = mod.SpawnObject(mod.RuntimeSpawn_Common.SFX_UI_Gamemode_Shared_CaptureObjectives_CapturingTick_IsEnemy_SimpleLoop2D, mod.CreateVector(0,0,0), mod.CreateVector(0,0,0), mod.CreateVector(1,1,1))
    let soundArray = mod.EmptyArray()
    soundArray = mod.AppendToArray(soundArray, tickAlly)
    soundArray = mod.AppendToArray(soundArray, tickEnemyLoop)
    soundArray = mod.AppendToArray(soundArray, onContestedLoop)
    soundArray = mod.AppendToArray(soundArray, onEnter)
    soundArray = mod.AppendToArray(soundArray, onExist)
    soundArray = mod.AppendToArray(soundArray, onCaptureByAlly)
    soundArray = mod.AppendToArray(soundArray, onNeutralize)
    mod.SetVariable(capturePointSound, soundArray)
}
//------UPDATE FUNCTION------//   
function updateOnFlagLayerCaptureProgress(player : mod.Player, captureProgress : number, layer : number) {
    const widgetIndex = 2 + layer * 4
    const widget = onFlagPlayerWidgets.get(mod.GetObjId(player))[widgetIndex]
    if(layer == 0) {
        (widget as UIText).textSize = 67 * captureProgress;
    }
    else {
        const size = 54 * captureProgress;
        (widget as UIContainer).setSize({ width: size, height: size } )
    }
}

function UpdatePlayerOnFlagLayer(player : mod.Player, nbPaxPlayers: number, nbNatoPlayer: number, flag: number) {
    const flagKeys = Object.keys(mod.stringkeys.flagKeys)
    const owner = flagOwner.get(flag + idOffsetOfFlag)
    const flagLetter = flagKeys[flag]
    const playerOnFlagWidget = onFlagPlayerWidgets.get(mod.GetObjId(player))
    const totalPlayerOnFlag = nbPaxPlayers + nbNatoPlayer
    const lineSizePerPlayer = 89 / totalPlayerOnFlag
    const playerTeamId = mod.GetObjId(mod.GetTeam(player))
    let nbAllyPlayers = nbNatoPlayer
    let nbEnemyPlayers = nbPaxPlayers
    if(playerTeamId == Team.Pax) {
        nbAllyPlayers = nbPaxPlayers
        nbEnemyPlayers = nbNatoPlayer
    }
    playerOnFlagWidget[14].width = lineSizePerPlayer * nbAllyPlayers;
    playerOnFlagWidget[15].width = lineSizePerPlayer * nbEnemyPlayers;
    (playerOnFlagWidget[16] as UIText).message = mod.Message(nbAllyPlayers);
    (playerOnFlagWidget[17] as UIText).message = mod.Message(nbEnemyPlayers);
    (playerOnFlagWidget[8] as UIText).message = mod.Message(flagLetter);
    (playerOnFlagWidget[12] as UIText).message = mod.Message(flagLetter);
    (playerOnFlagWidget[4] as UIText).message = mod.Message(flagLetter);
    if(owner == Team.Neutral) {
        playerOnFlagWidget[13].visible = true;
        (playerOnFlagWidget[18] as UIText).message = mod.Message(mod.stringkeys.capturing);
    }
    else if(playerTeamId != owner) {
        playerOnFlagWidget[13].visible = true;
        (playerOnFlagWidget[18] as UIText).message = mod.Message(mod.stringkeys.neutralazing);
    }
    else {
        if(nbEnemyPlayers == 0) {
            playerOnFlagWidget[13].visible = false;
        }
        else {
            playerOnFlagWidget[13].visible = true;
        }
        (playerOnFlagWidget[18] as UIText).message = mod.Message(mod.stringkeys.defending);
    }
}
function AddToScore(number : number, team : number) {
    const widgetsArrayNato = teamScoreUi.get(Team.Nato);
    const widgetsArrayPax = teamScoreUi.get(Team.Pax);
    const scoreNatoTextWidget = new Array<UIText>(widgetsArrayNato[2] as UIText, widgetsArrayPax[3] as UIText)
    const scorePaxTextWidget = new Array<UIText>(widgetsArrayNato[3] as UIText, widgetsArrayPax[2] as UIText)
    const scoreNatoLineWidget = new Array<UIContainer>(widgetsArrayNato[0] as UIContainer, widgetsArrayPax[1] as UIContainer)
    const scorePaxLineWidget = new Array<UIContainer>(widgetsArrayNato[1] as UIContainer, widgetsArrayPax[0] as UIContainer)
    const scoreNatoOutline = new Array<UIContainer>(widgetsArrayNato[4] as UIContainer, widgetsArrayPax[5] as UIContainer)
    const scorePaxOutline = new Array<UIContainer>(widgetsArrayNato[5] as UIContainer, widgetsArrayPax[4] as UIContainer)
    if(team == Team.Nato) {
        const newScore = teamScore.get(Team.Nato) + number
        if(newScore <= 0) {
            GameWin(Team.Pax)
        }
        else if(newScore <= (startScoreNato / 20)) {
            mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
        }
        teamScore.set(Team.Nato, newScore)
        const sizeLine = 180 * (newScore / startScoreNato)
        scoreNatoTextWidget.forEach((widget) => widget.message = mod.Message(newScore))
        scoreNatoLineWidget.forEach((widget) => widget.width = sizeLine)
    }
    else if (team == Team.Pax) {
        const newScore = teamScore.get(Team.Pax) + number
        if(newScore <= 0) {
           GameWin(Team.Nato)
        }
        else if(newScore <= (startScorePax / 20)) {
            mod.PlayMusic(mod.MusicEvents.Core_Overtime_Loop)
        }
        teamScore.set(Team.Pax, newScore)
        const sizeLine = 180 * (newScore / startScorePax)
        scorePaxTextWidget.forEach((widget) => widget.message = mod.Message(newScore))
        scorePaxLineWidget.forEach((widget) => widget.width = sizeLine)
    }
    const natoScore = teamScore.get(Team.Nato)
    const paxScore = teamScore.get(Team.Pax)
    scoreNatoOutline.forEach((widget) => widget.visible = natoScore > paxScore)
    scorePaxOutline.forEach((widget) => widget.visible = natoScore < paxScore)
}
//-------DISPLAY FUNCTION----//
function DisplayOnFlagLayer(player : mod.Player, flag: number) {
    const playerOnFlagWidget = onFlagPlayerWidgets.get(mod.GetObjId(player));
    const owner = flagOwner.get(flag + idOffsetOfFlag)
    const playerTeamId = mod.GetObjId(mod.GetTeam(player))
    const isTeamNeutral = owner == Team.Neutral
    const isSameTeam = playerTeamId == owner
    playerOnFlagWidget[0].visible = true;
    playerOnFlagWidget[1].visible = isSameTeam
    playerOnFlagWidget[5].visible = isTeamNeutral
    playerOnFlagWidget[9].visible = !isTeamNeutral && !isSameTeam
}
function removeFromViewOnFlagLayer(player : mod.Player) {
    const playerOnFlagWidget = onFlagPlayerWidgets.get(mod.GetObjId(player));
    (playerOnFlagWidget[0] as UIContainer).visible = false;
    for(let x = 0; x < 3; x += 1) {
        updateOnFlagLayerCaptureProgress(player, 1, x)
    }
}

    //--------UI FONCTION---------------//
function MakeFlagUiLayer(nb_flag : number) {
    const neutralFlags = MakeNeutralFlagUiLayer(nb_flag)
    const allyFlags = MakeAllyFlagUiLayer(nb_flag)
    const enemyFlags = MakeEnemyFlagUiLayer(nb_flag)
    const natoFlags = neutralFlags[0].concat(allyFlags[0].concat(enemyFlags[0]))
    const paxFlags = neutralFlags[1].concat(allyFlags[1].concat(enemyFlags[1]))
    teamFlagsUi.set(Team.Nato, natoFlags)
    teamFlagsUi.set(Team.Pax, paxFlags)
}
function MakeAllyFlagUiLayer(nb_flag : number) {
    const flagKeys = Object.keys(mod.stringkeys.flagKeys);
    let natoFlagsArray = new Array<UI.Element>
    let paxFlagsArray = new Array<UI.Element>

    for(let x = 0; x < 2; x += 1) {
        const teamId = x === 0 ? Team.Nato : Team.Pax
        const highestUiLayer = teamUiAnchors.get(teamId) as UIContainer
        let flagsArray = new Array<UI.Element>();

        // Base layer for this team's ally flags
        const allyUiLayer = new UIContainer({
            parent: highestUiLayer,
            position: { x: 0, y: 113 },
            size: { width: 0, height: 0 },
            anchor: mod.UIAnchor.TopCenter,
            visible: true,
            bgFill: mod.UIBgFill.None
        });

        for(let l = 0; l < nb_flag; l += 1) {
            const baseIU = new UIContainer({
                parent: allyUiLayer,
                position: { x: l * 42 - ((nb_flag - 1) * 21), y: 0 },
                size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.TopCenter,
                visible: false,
                bgFill: mod.UIBgFill.None
            });
            flagsArray.push(baseIU)
            // Outline Circle
            const outline = new UIText({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.None,
                message: mod.Message(mod.stringkeys.pt), textSize: 40, textColor: blueColor, textAlpha: colorAlpha
            });
            // Inside Circle
            const inside = new UIText({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.None,
                message: mod.Message(mod.stringkeys.pt), textSize: 36, textColor: blackColor, textAlpha: insideAlpha
            });
            // Letter
            const letter = new UIText({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.None,
                message: mod.Message(flagKeys[l]), textSize: 17, textColor: blueColor, textAlpha: colorAlpha
            });
        }

        if(x == 0) natoFlagsArray = flagsArray 
        else paxFlagsArray = flagsArray
    } 
    return [natoFlagsArray, paxFlagsArray];
}
function MakeNeutralFlagUiLayer(nb_flag : number) {
    const flagKeys = Object.keys(mod.stringkeys.flagKeys);
    let natoFlagsArray = new Array<UI.Element>
    let paxFlagsArray = new Array<UI.Element>

    for(let x = 0; x < 2; x += 1) {
        const teamId = x === 0 ? Team.Nato : Team.Pax
        const highestUiLayer = teamUiAnchors.get(teamId) as UIContainer
        let flagsArray = new Array<UI.Element>();

        // Base layer for this team's ally flags
        const neutralUiLayer = new UIContainer({
            parent: highestUiLayer,
            position: { x: 0, y: 113 },
            size: { width: 0, height: 0 },
            anchor: mod.UIAnchor.TopCenter,
            visible: true,
            bgFill: mod.UIBgFill.None
        });

        for(let l = 0; l < nb_flag; l += 1) {
            const baseIU = new UIContainer({
                parent: neutralUiLayer,
                position: { x: l * 42 - ((nb_flag - 1) * 21), y: 0 },
                size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.TopCenter,
                visible: true,
                bgFill: mod.UIBgFill.None
            });
            flagsArray.push(baseIU)
            // Outline
            const outline = new UIContainer({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 33, height: 33 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.Solid,
                bgAlpha: colorAlpha,
                bgColor: whiteColor
                
            })
            // Inside
            const inside = new UIContainer({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 30, height: 30 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.Solid,
                bgAlpha: colorAlpha,
                bgColor: blackColor
                
            })

            // Letter
            const letter = new UIText({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.None,
                message: mod.Message(flagKeys[l]), textSize: 17, textColor: whiteColor, textAlpha: colorAlpha
            });
        }

        if(x == 0) natoFlagsArray = flagsArray 
        else paxFlagsArray = flagsArray
    } 
    return [natoFlagsArray, paxFlagsArray];
}
function MakeEnemyFlagUiLayer(nb_flag : number) {
    const flagKeys = Object.keys(mod.stringkeys.flagKeys);
    let natoFlagsArray = new Array<UI.Element>
    let paxFlagsArray = new Array<UI.Element>

    for(let x = 0; x < 2; x += 1) {
        const teamId = x === 0 ? Team.Nato : Team.Pax
        const highestUiLayer = teamUiAnchors.get(teamId) as UIContainer
        let flagsArray = new Array<UI.Element>();

        // Base layer for this team's ally flags
        const enemyUiLayer = new UIContainer({
            parent: highestUiLayer,
            position: { x: 0, y: 113 },
            size: { width: 0, height: 0 },
            anchor: mod.UIAnchor.TopCenter,
            visible: true,
            bgFill: mod.UIBgFill.None
        });

        for(let l = 0; l < nb_flag; l += 1) {
            const baseIU = new UIContainer({
                parent: enemyUiLayer,
                position: { x: l * 42 - ((nb_flag - 1) * 21), y: 0 },
                size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.TopCenter,
                visible: false,
                bgFill: mod.UIBgFill.None
            });
            flagsArray.push(baseIU)
            // Outline
            new UIContainer({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 33, height: 33 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.Solid,
                bgAlpha: colorAlpha,
                bgColor: redColor
                
            })
            // Inside
            new UIContainer({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 30, height: 30 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.Solid,
                bgAlpha: colorAlpha,
                bgColor: blackColor
                
            })

            // Letter
            new UIText({
                parent: baseIU,
                position: { x: 0, y: 0 }, size: { width: 0, height: 0 },
                anchor: mod.UIAnchor.Center, visible: true,
                bgFill: mod.UIBgFill.None,
                message: mod.Message(flagKeys[l]), textSize: 17, textColor: redColor, textAlpha: colorAlpha
            });
        }

        if(x == 0) natoFlagsArray = flagsArray 
        else paxFlagsArray = flagsArray
    } 
    return [natoFlagsArray, paxFlagsArray];
}
function MakeUiTeamAnchor() {
    const highestUiLayerNato = new UIContainer({
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        bgFill: mod.UIBgFill.None,
        receiver: mod.GetTeam(Team.Nato)
    })
    const highestUiLayerPax = new UIContainer({
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        bgFill: mod.UIBgFill.None,
        receiver: mod.GetTeam(Team.Pax)
    })

    teamUiAnchors.set(Team.Nato, highestUiLayerNato)
    teamUiAnchors.set(Team.Pax, highestUiLayerPax)
}
function MakeScoreUi() {
    for(let x = 0; x < 2; x += 1) {
        const teamId = x === 0 ? Team.Nato : Team.Pax;
        const highestUiLayer = teamUiAnchors.get(teamId) as UIContainer

        // --- Ally Background & Score Line ---
        const baseLineAlly = new UIContainer({
            parent: highestUiLayer,
            position: { x: -183, y: 65 },
            size: { width: 180, height: 12 },
            anchor: mod.UIAnchor.TopLeft,
            visible: true,
            bgColor: darkBlueColor,
            bgAlpha: 0.8,
            bgFill: mod.UIBgFill.Blur
        });

        const scoreLineAlly = new UIContainer({
            parent: baseLineAlly,
            position: { x: 0, y: 0 },
            size: { width: 180, height: 12 },
            anchor: mod.UIAnchor.TopLeft,
            visible: true,
            bgColor: blueColor,
            bgAlpha: 1,
            bgFill: mod.UIBgFill.Solid
        });

        // --- Enemy Background & Score Line ---
        const baseLineEnemy = new UIContainer({
            parent: highestUiLayer,
            position: { x: 3, y: 65 },
            size: { width: 180, height: 12 },
            anchor: mod.UIAnchor.TopLeft,
            visible: true,
            bgColor: darkRedColor,
            bgAlpha: 0.8,
            bgFill: mod.UIBgFill.Blur
        });

        const scoreLineEnemy = new UIContainer({
            parent: baseLineEnemy,
            position: { x: 0, y: 0 },
            size: { width: 180, height: 12 },
            anchor: mod.UIAnchor.TopRight,
            visible: true,
            bgColor: redColor,
            bgAlpha: 1,
            bgFill: mod.UIBgFill.Solid
        });

        // --- Ally Score Text Base ---
        const scoreBaseAlly = new UIContainer({
            parent: highestUiLayer,
            position: { x: -276, y: 54 },
            size: { width: 84, height: 33 },
            anchor: mod.UIAnchor.TopLeft,
            visible: true,
            bgColor: darkBlueColor,
            bgAlpha: 0.8,
            bgFill: mod.UIBgFill.Blur
        });

        const scoreTextAlly = new UIText({
            parent: scoreBaseAlly,
            position: { x: 0, y: 0 },
            size: { width: 0, height: 0 },
            anchor: mod.UIAnchor.Center,
            visible: true,
            message: mod.Message(teamScore.get(teamId)),
            textSize: 35,
            textColor: blueColor,
            bgAlpha: 1
        });

        // --- Enemy Score Text Base ---
        const scoreBaseEnemy = new UIContainer({
            parent: highestUiLayer,
            position: { x: 191, y: 54 },
            size: { width: 84, height: 33 },
            anchor: mod.UIAnchor.TopLeft,
            visible: true,
            bgColor: darkRedColor,
            bgAlpha: 0.8,
            bgFill: mod.UIBgFill.Blur
        });

        const scoreTextEnemy = new UIText({
            parent: scoreBaseEnemy,
            position: { x: 0, y: 0 },
            size: { width: 0, height: 0 },
            anchor: mod.UIAnchor.Center,
            visible: true,
            message: mod.Message(teamId == Team.Pax ? teamScore.get(Team.Nato) : teamScore.get(Team.Pax)),
            textSize: 35,
            textColor: redColor,
            bgAlpha: 1
        });

        // --- Ally Outline ---
        const scoreOutlineAlly = new UIContainer({
            parent: scoreBaseAlly,
            position: { x: 0, y: 0 },
            size: { width: 84, height: 33 },
            anchor: mod.UIAnchor.TopLeft,
            visible: false
        });
        
        // Outline pieces
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:2,height:33}, anchor: mod.UIAnchor.TopLeft, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.TopLeft, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.BottomLeft, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:2,height:33}, anchor: mod.UIAnchor.TopRight, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.TopRight, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineAlly, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.BottomRight, visible: true, bgColor: blueColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });

        // --- Enemy Outline ---
        const scoreOutlineEnemy = new UIContainer({
            parent: scoreBaseEnemy,
            position: { x: 0, y: 0 },
            size: { width: 84, height: 33 },
            anchor: mod.UIAnchor.TopLeft,
            visible: false
        });

        // Outline pieces
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:2,height:33}, anchor: mod.UIAnchor.TopLeft, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.TopLeft, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.BottomLeft, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:2,height:33}, anchor: mod.UIAnchor.TopRight, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.TopRight, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        new UIContainer({ parent: scoreOutlineEnemy, position: {x:0,y:0}, size: {width:8,height:2}, anchor: mod.UIAnchor.BottomRight, visible: true, bgColor: redColor, bgAlpha: 1, bgFill: mod.UIBgFill.Solid });
        
        const widgetsArray = new Array<UI.Element>(scoreLineAlly, scoreLineEnemy, scoreTextAlly, scoreTextEnemy, scoreOutlineAlly, scoreOutlineEnemy)
        teamScoreUi.set(teamId, widgetsArray)
    }
}
function MakeUiAnchorPlayer(player: mod.Player) {
    const highestUiLayer = new UIContainer({
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        receiver: player,
        visible: true,
        depth: mod.UIDepth.AboveGameUI
    });
    playerUiAnchor.set(mod.GetObjId(player), highestUiLayer)
}
function MakeOnFlagUiLayer(player: mod.Player) {
    // Retrieve the anchor object (which should now be a UIContainer instance)
    const anchor = playerUiAnchor.get(mod.GetObjId(player)) as UIContainer

    // --- Main Layer ---
    const highestUiLayer = new UIContainer({
        parent: anchor,
        position: { x: 0, y: 0 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        visible: false,
        receiver: player // Inherited by all children
    });

    // --- Ally Flag ---
    const allyUiLayer = new UIContainer({
        parent: highestUiLayer,
        position: { x: 0, y: 200 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        visible: false,
        bgFill: mod.UIBgFill.Blur
    });

    const allyOutline = new UIText({
        parent: allyUiLayer,
        anchor: mod.UIAnchor.Center,
        visible: true,
        message: mod.Message(mod.stringkeys.pt),
        textSize: 67,
        textColor: blueColor,
        textAlpha: colorAlpha,
        depth: mod.UIDepth.AboveGameUI
    });

    const allyInside = new UIText({
        parent: allyUiLayer,
        anchor: mod.UIAnchor.Center,
        visible: true,
        message: mod.Message(mod.stringkeys.pt),
        textSize: 60,
        textColor: blackColor,
        textAlpha: insideAlpha,
        depth: mod.UIDepth.AboveGameUI
    });

    const letterAlly = new UIText({
        parent: allyUiLayer,
        anchor: mod.UIAnchor.Center,
        visible: true,
        message: mod.Message(mod.stringkeys.flagKeys.A),
        textSize: 28,
        textColor: blueColor,
        textAlpha: colorAlpha,
        depth: mod.UIDepth.AboveGameUI
    });

    // --- Neutral Flag ---
    const neutralUiLayer = new UIContainer({
        parent: highestUiLayer,
        position: { x: 0, y: 200 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        visible: true,
        bgFill: mod.UIBgFill.Blur
    });

    const neutralOutline = new UIContainer({
        parent: neutralUiLayer,
        size: { width: 54, height: 54 },
        anchor: mod.UIAnchor.Center,
        visible: true,
        bgColor: whiteColor,
        bgAlpha: colorAlpha,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const neutralInside = new UIContainer({
        parent: neutralUiLayer,
        size: { width: 49, height: 49 },
        anchor: mod.UIAnchor.Center,
        visible: true,
        bgColor: blackColor,
        bgAlpha: insideAlpha,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const letterNeutral = new UIText({
        parent: neutralUiLayer,
        anchor: mod.UIAnchor.Center,
        visible: true,
        message: mod.Message(mod.stringkeys.flagKeys.A),
        textSize: 28,
        textColor: whiteColor,
        bgAlpha: colorAlpha,
        depth: mod.UIDepth.AboveGameUI
    });

    // --- Enemy Flag ---
    const enemyUiLayer = new UIContainer({
        parent: highestUiLayer,
        position: { x: 0, y: 200 },
        size: { width: 0, height: 0 },
        anchor: mod.UIAnchor.TopCenter,
        visible: false,
        bgFill: mod.UIBgFill.Blur,
        depth: mod.UIDepth.AboveGameUI
    });

    const enemyOutline = new UIContainer({
        parent: enemyUiLayer,
        size: { width: 54, height: 54 },
        anchor: mod.UIAnchor.Center,
        visible: true,
        bgColor: redColor,
        bgAlpha: colorAlpha,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const enemyInside = new UIContainer({
        parent: enemyUiLayer,
        size: { width: 49, height: 49 },
        anchor: mod.UIAnchor.Center,
        visible: true,
        bgColor: blackColor,
        bgAlpha: insideAlpha,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const letterEnemy = new UIText({
        parent: enemyUiLayer,
        anchor: mod.UIAnchor.Center,
        visible: true,
        message: mod.Message(mod.stringkeys.flagKeys.A),
        textSize: 28,
        textColor: redColor,
        bgAlpha: colorAlpha,
        depth: mod.UIDepth.AboveGameUI
    });

    // --- Contestation Logic ---
    const contestLine = new UIContainer({
        parent: highestUiLayer,
        position: { x: 0, y: 238 },
        size: { width: 89, height: 6 },
        anchor: mod.UIAnchor.TopCenter,
        visible: true,
        bgColor: blueColor,
        bgAlpha: 1,
        bgFill: mod.UIBgFill.None,
        depth: mod.UIDepth.AboveGameUI
    });

    const contestLineAlly = new UIContainer({
        parent: contestLine,
        size: { width: 89, height: 6 },
        anchor: mod.UIAnchor.TopLeft,
        visible: true,
        bgColor: blueColor,
        bgAlpha: 1,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const contestLineEnemy = new UIContainer({
        parent: contestLine,
        size: { width: 89, height: 6 },
        anchor: mod.UIAnchor.TopRight,
        visible: true,
        bgColor: redColor,
        bgAlpha: 1,
        bgFill: mod.UIBgFill.Solid,
        depth: mod.UIDepth.AboveGameUI
    });

    const contestNumAlly = new UIText({
        parent: contestLine,
        position: { x: -13, y: 0 },
        anchor: mod.UIAnchor.CenterLeft,
        visible: true,
        message: mod.Message(2),
        textSize: 18,
        textColor: blueColor,
        bgAlpha: 0.6,
        depth: mod.UIDepth.AboveGameUI
    });

    const contestNumEnemy = new UIText({
        parent: contestLine,
        position: { x: -13, y: 0 },
        anchor: mod.UIAnchor.CenterRight,
        visible: true,
        message: mod.Message(2),
        textSize: 18,
        textColor: redColor,
        bgAlpha: 0.6,
        depth: mod.UIDepth.AboveGameUI
    });

    const capturePointMsg = new UIText({
        parent: contestLine,
        position: { x: 0, y: -13 },
        anchor: mod.UIAnchor.BottomCenter,
        visible: true,
        message: mod.Message(mod.stringkeys.defending),
        textSize: 18,
        textColor: whiteColor,
        bgAlpha: 0.6,
        depth: mod.UIDepth.AboveGameUI
    });

    // --- Array Compilation ---
    const widgetsArray = new Array<UI.Element>(highestUiLayer, allyUiLayer, allyOutline, allyInside, letterAlly, neutralUiLayer,neutralOutline,
        neutralInside, letterNeutral, enemyUiLayer, enemyOutline, enemyInside, letterEnemy, contestLine, contestLineAlly,
         contestLineEnemy, contestNumAlly, contestNumEnemy, capturePointMsg
    ) 
    onFlagPlayerWidgets.set(mod.GetObjId(player), widgetsArray)
}
//-------OTHER FUNCTION------//
function RemoveInvalidPlayerFromFlag() {
    for(let x = 0; x < nbFlags; x += 1) {
        const currCapturePoint = mod.ValueInArray(mod.AllCapturePoints(), x)
        const capturePointId = mod.GetObjId(currCapturePoint)
        const natoPlayers = natoPlayersOnCapturePoint.get(capturePointId)
        const paxPlayers = paxPlayersOnCapturePoint.get(capturePointId)
        const newNatoPlayers = natoPlayers.filter((player) => mod.IsPlayerValid(player));
        const newPaxPlayers =  paxPlayers.filter((player) =>mod.IsPlayerValid(player));
        
        if(newNatoPlayers.length != natoPlayers.length) {
            natoPlayersOnCapturePoint.set(capturePointId, newNatoPlayers)
            NotifyPlayersOfPopulationChangeOnFlag(currCapturePoint)
        }
        else if(newPaxPlayers.length != paxPlayers.length) {
            paxPlayersOnCapturePoint.set(capturePointId, newPaxPlayers)
            NotifyPlayersOfPopulationChangeOnFlag(currCapturePoint)
        }
    }
}


function GameWin(team : Team) {
    mod.EndGameMode(mod.GetTeam(team))
    mod.PlayMusic(mod.MusicEvents.Core_EndOfRound_Loop)
   
}
function ApplyAlphaFunction(widget : UI.Element, alpha : number) {
    if(widget instanceof UIText) {
        widget.textAlpha = alpha
    }
    else {
        widget.bgAlpha = alpha
    }
}

