import React, { useState, useEffect, createContext, useContext, useCallback, useReducer } from "react";
import createPersistedState from 'use-persisted-state';
import _ from 'lodash';

import {
  Button,
  ButtonGroup,
  Box,
  Card,
  CardActions,
  CardContent,
  CardHeader,
  Checkbox,
  Container,
  ClickAwayListener,
  Collapse,
  Divider,
  Grid,
  Grow,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  MenuList,
  Paper,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@material-ui/core';
import {
  makeStyles,
} from '@material-ui/styles';
import Autocomplete, { createFilterOptions } from '@material-ui/lab/Autocomplete';
import GavelIcon from '@material-ui/icons/Gavel';
import ExpandLess from '@material-ui/icons/ExpandLess';
import ExpandMore from '@material-ui/icons/ExpandMore';
//pact-lang-api for blockchain calls
import Pact from "pact-lang-api";
//config file for blockchain calls
import { PactTxStatus } from "./PactTxStatus.js";
import {
  PactJsonListAsTable,
  PactSingleJsonAsTable,
  MakeInputField,
  updateParams,
  renderPactValue,
 } from "./util.js";
import { keyFormatter } from "./kadena-config.js";

const useStyles = makeStyles(() => ({
  formControl: {
    margin: "5px auto",
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: "10px auto",
  },
  inline: {
    display: "inline",
  },
}));

const walletContextDefault = {
  current: {},
  otherWallets: {},
  allKeys: [],
  contractConfigs: {},
  pastPactTxs: [],
};

export const WalletContext = createContext();

const walletReducer = (state, action) => {
  switch (action.type) {
    case 'updateWallet':
      if (! _.has(action, "newWallet")) {throw new Error("updateWallet requires newWallet:{walletName,gasPrice,networkId,signingKey} key")};
      const prevWallet = _.cloneDeep(state.current);
      const otherWallets = _.cloneDeep(state.otherWallets);
      if (prevWallet.walletName) {
        // stops a bug on initial load where "undefined" is added as a wallet
        otherWallets[prevWallet.walletName] = prevWallet;}
      if (action.newWallet.walletName) {
        otherWallets[action.newWallet.walletName] = action.newWallet;
      } else {
        throw new Error("updateWallet requires newWallet:{walletName,gasPrice,networkId,signingKey} key")};
      const allKeys1 = _.filter(_.uniq(_.concat(_.cloneDeep(state.allKeys),action.newWallet.signingKey)),v=>v?true:false);
      return {...state, current: action.newWallet, otherWallets: otherWallets, allKeys: allKeys1};
    case 'addKeys':
      if (! _.has(action, "newKeys")) {throw new Error("addKeys requires newKeys:[] key")};
      const allKeys2 = _.filter(_.uniq(_.concat(_.cloneDeep(state.allKeys), action.newKeys)),v=>v?true:false);
      return {...state, allKeys: allKeys2};
    case 'addConfig':
      if (! _.has(action, "configName")) {throw new Error("addConfig requires configName:'' key")};
      if (! _.has(action, "config")) {throw new Error("addConfig requires config:'' key")};
      const configs = _.cloneDeep(state.contractConfigs);
      configs[action.configName] = action.config;
      return {...state, contractConfigs:configs};
    case 'tractPactTx':
      if (! _.has(action, "newTx")) {throw new Error("trackPactTx requires newTx:'' key")};
      const newPactTxs = _.concat(_.cloneDeep(state.pastPactTxs),action.newTx);
      return {...state, pastPactTxs: newPactTxs};
    default:
      throw new Error(JSON.stringify(action));
  }
}

export const Wallet = ({contractConfigs, children}) => {
  //Wallet State
  const usePersistedWallet = createPersistedState("pactWallet5");
  const [persistedWallet,setPersistedWallet] = usePersistedWallet({});
  const [wallet,walletDispatch] = useReducer(walletReducer, _.size(persistedWallet) ? _.cloneDeep(persistedWallet) : walletContextDefault);
  // Experimental wrapper for "emit" bug found in https://github.com/donavon/use-persisted-state/issues/56
  useEffect(()=>{
    if (_.size(wallet) && ! _.isEqual(walletContextDefault, wallet)) {
      console.debug("Wallet.useEffect[persistedWallet,walletProvider,setPersistedWallet]", persistedWallet, " =to=> ", wallet);
      setPersistedWallet(wallet);}}
  ,[persistedWallet,wallet,setPersistedWallet]);

  useEffect(()=>{
    console.debug("Wallet.useEffect[] fired, contratConfigs added: ", _.keys(contractConfigs));
    _.mapKeys(contractConfigs,(k)=>walletDispatch({type:"addConfig", configName:k, config:contractConfigs[k]}))
  }
  ,[])

  return <WalletContext.Provider value={{wallet,walletDispatch}}>
          {children}
         </WalletContext.Provider>
}

export const useWallet = () => {
  const {wallet} = useContext(WalletContext);
  return wallet;
};

export const useWalletContex = () => useContext(WalletContext);

export const walletDrawerEntries = {
  primary:"Wallet",
  subList:
    [{
      primary:"Config",
      to:{app:"wallet", ui: "config"}
    }
  ]
};

export const WalletApp = ({
  appRoute, 
  setAppRoute,
}) => {

  return (
    appRoute.ui === "config" ?
    <Card>
      <CardHeader title="Wallet Configuration"/>
      <CardContent>
        <WalletConfig/>
        <CurrentWallet/>
        <OtherWallets/>
      </CardContent>
    </Card>
  : <React.Fragment>
      {setAppRoute({app:"wallet", ui:"config"})}
  </React.Fragment>
  )
};
export const addGasCap = (otherCaps) => _.concat([Pact.lang.mkCap("Gas Cap", "Gas Cap", "coin.GAS", [])], otherCaps);

const walletCmd = async (
  setTx,
  setTxStatus,
  setTxRes,
  user, 
  signingPubKey, 
  networkId,
  gasPrice,
  host
) => {
    try {
      //creates transaction to send to wallet
      const toSign = {
          pactCode: "(+ 1 1)",
          caps: [
            Pact.lang.mkCap("Gas Cap"
                           , "Gas Cap"
                           , "coin.GAS"
                           , [])
          ],
          gasLimit: 1000,
          gasPrice: gasPrice,
          chainId: "0",
          signingPubKey: signingPubKey,
          networkId: networkId,
          ttl: 28800,
          sender: user,
          envData: {foo: "bar"}
      }
      console.log("toSign", toSign)
      //sends transaction to wallet to sign and awaits signed transaction
      const signed = await Pact.wallet.sign(toSign)
      console.log("signed", signed)
      if ( typeof signed === 'object' && 'hash' in signed ) {
        setTx(signed);
      } else {
        throw new Error("Signing API Failed");
      }

      //sends signed transaction to blockchain
      const txReqKeys = await Pact.wallet.sendSigned(signed, host)
      console.log("txReqKeys", txReqKeys)
      //set html to wait for transaction response
      //set state to wait for transaction response
      setTxStatus('pending')
      try {
        //listens to response to transaction sent
        //  note method will timeout in two minutes
        //    for lower level implementations checkout out Pact.fetch.poll() in pact-lang-api
        let retries = 8;
        let res = {};
        while (retries > 0) {
          //sleep the polling
          await new Promise(r => setTimeout(r, 15000));
          res = await Pact.fetch.poll(txReqKeys, host);
          try {
            if (res[signed.hash].result.status) {
              retries = -1;
            } else {
              retries = retries - 1;
            }
          } catch(e) {
              retries = retries - 1;
          }
        };
        //keep transaction response in local state
        setTxRes(res)
        if (res[signed.hash].result.status === "success"){
          console.log("tx status set to success");
          //set state for transaction success
          setTxStatus('success');
        } else if (retries === 0) {
          console.log("tx status set to timeout");
          setTxStatus('timeout');
        } else {
          console.log("tx status set to failure");
          //set state for transaction failure
          setTxStatus('failure');
        }
      } catch(e) {
        // TODO: use break in the while loop to capture if timeout occured
        console.log("tx api failure",e);
        setTxRes(e);
        setTxStatus('failure');
      }
    } catch(e) {
      setTxRes(e.toString());
      console.log("tx status set to validation error",e);
      //set state for transaction construction error
      setTxStatus('validation-error');
    }
};

const filter = createFilterOptions();

const EntrySelector = ({
  label,
  getVal,
  setVal,
  allOpts
}) => {
  const classes = useStyles();
  let localOptions = allOpts ? _.cloneDeep(allOpts) : [""];

  return (
    <Autocomplete
      className={classes.formControl}
      value={getVal}
      onChange={(event, newValue) => {
        if (typeof newValue === 'string') {
          setVal(newValue);
        } else if (newValue && newValue.inputValue) {
          // Create a new value from the user input
          setVal(newValue.inputValue)
        } else {
          setVal(newValue);
        }
      }}
      filterOptions={(options, params) => {
        const filtered = filter(options, params);

        // Suggest the creation of a new value
        if (params.inputValue !== '') {
          filtered.push({
            inputValue: params.inputValue,
            title: `Add "${params.inputValue}"`,
          });
        }

        return filtered;
      }}
      selectOnFocus
      fullWidth
      clearOnBlur
      handleHomeEndKeys
      defaultValue={getVal ? getVal : null}
      options={localOptions}
      getOptionLabel={(option) => {
        // Value selected with enter, right from the input
        // Add "xxx" option created dynamically
        if (option.inputValue) {
          return option.inputValue;
        } else {
          // Regular option
          return option;
        }
      }}
      renderOption={(option) => option.title ? option.title : option}
      freeSolo
      renderInput={(params) => (
        <TextField {...params} label={label} variant="outlined" fullWidth className={classes.formControl} />
      )}
    />
  );
}

export const CurrentWallet = () => {
  const {current} = useWallet();
  
  return <Container style={{"paddingTop":"2em"}}>
    <Typography component="h2">Active Wallet</Typography>
    <PactSingleJsonAsTable
      json={current}
      keyFormatter={keyFormatter}
      />
  </Container>
};

export const OtherWallets = () => {
  const {otherWallets} = useWallet();
  
  return <Container style={{"paddingTop":"2em"}}>
    <Typography component="h2">All Saved Wallets</Typography>
    <PactSingleJsonAsTable
      json={otherWallets}
      keyFormatter={keyFormatter}
      />
  </Container>
};

export const WalletConfig = () => {
  const {wallet, walletDispatch} = useContext(WalletContext);
  const [saved,setSaved] = useState(false);
  const [walletName,setWalletName] = useState("");
  const [signingKey, setSigningKey] = useState("");
  const [networkId, setNetworkId] = useState("testnet04");
  const [gasPrice, setGasPrice] = useState("");
  const classes = useStyles();

  const [txStatus, setTxStatus] = useState("");
  const [tx, setTx] = useState({});
  const [txRes, setTxRes] = useState({});

  useEffect(()=> {
    console.debug("WalletConfig useEffect on load fired with", wallet)
    if (_.size(wallet.current)) {
        if (wallet.current.walletName) {setWalletName(wallet.current.walletName)}
        if (wallet.current.signingKey) {setSigningKey(wallet.current.signingKey)}
        if (wallet.current.gasPrice) {setGasPrice(wallet.current.gasPrice)}
        if (wallet.current.networkId) {setNetworkId(wallet.current.networkId)}
    } 
  }
  ,[]);
  
  useEffect(()=>{
    if (_.size(wallet.otherWallets[walletName])) {
      const loadingWallet = wallet.otherWallets[walletName];
      console.debug("WalletConfig updating entries", loadingWallet)
        if (loadingWallet.walletName && loadingWallet.signingKey && loadingWallet.gasPrice && loadingWallet.networkId) {
          setGasPrice(loadingWallet.gasPrice);
          setSigningKey(loadingWallet.signingKey);
          setNetworkId(loadingWallet.networkId);
          setWalletName(loadingWallet.walletName);
        }
    }
  },[walletName])

  useEffect(()=>setSaved(false),[walletName,signingKey,gasPrice,networkId]);

  const handleSubmit = (evt) => {
      evt.preventDefault();
      if (saved) {
        const host = networkId === "testnet04" ? 
          `https://api.testnet.chainweb.com/chainweb/0.0/${networkId}/chain/0/pact` : 
          `https://api.chainweb.com/chainweb/0.0/${networkId}/chain/0/pact`; 
        walletCmd(
          setTx,
          setTxStatus,
          setTxRes,
          signingKey,
          signingKey, 
          networkId,
          Number.parseFloat(gasPrice), 
          host);
      } else {
        const n = {walletName:walletName, signingKey:signingKey, gasPrice:gasPrice, networkId:networkId};
        walletDispatch({type: 'updateWallet', newWallet: n});
        setSaved(true);
        console.debug("WalletConfig set. locale: ", n, " while context is: ", wallet.current);
      }
  };
  const inputFields = [
    {
      type:'textFieldSingle',
      label:'Gas Price',
      className:classes.formControl,
      value:gasPrice,
      onChange:setGasPrice,
    }];

  return <Container style={{"paddingTop":"1em"}}>
    <Typography component="h2">Add or Update Wallet</Typography>
      <form
        autoComplete="off"
        onSubmit={(evt) => handleSubmit(evt)}>
        <EntrySelector label="Wallet Name" getVal={walletName} setVal={setWalletName} allOpts={_.keys(wallet.otherWallets)}/>
        <EntrySelector label="Network ID" getVal={networkId} setVal={setNetworkId} allOpts={_.uniq(_.concat(_.map(wallet.otherWallets, 'networkId'), "mainnet01", "testnet04"))}/>
        {inputFields.map(f =>
          <MakeInputField inputField={f}/>
        )}
        <EntrySelector label="Select Signing Key" getVal={signingKey} setVal={setSigningKey} allOpts={wallet.allKeys}/>
        <CardActions>
            <Button variant="outlined" color="default" type="submit">
                {saved ? "Test Current Settings" : "Save New Settings" }
            </Button>
        </CardActions>
      </form>
      { txStatus === 'pending' ? <LinearProgress /> : null }
      <PactTxStatus tx={tx} txRes={txRes} txStatus={txStatus} setTxStatus={setTxStatus}/>
  </Container>
}
