// For util functions
import React, {useState, useEffect} from "react";
import { makeStyles } from '@material-ui/core/styles';
//Table Stuff
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ListSubheader,
  Checkbox,
} from '@material-ui/core';
import {
  Button,
  LinearProgress,
  TextField,
  MenuItem,
  CardActions,
} from '@material-ui/core';
//pact-lang-api for blockchain calls
//config file for blockchain calls
import { PactTxStatus } from "./PactTxStatus.js";

export const useInputStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      width: '25ch',
    },
  },
  margin: {
    margin: theme.spacing(1),
  },
  withoutLabel: {
    marginTop: theme.spacing(3),
  },
  textField: {
    width: '25ch',
  },
}));

//config file for blockchain calls

export const dashStyleNames2Text = str => str.split("-").map(k=>k.replace(new RegExp("^.","gm"),a=>a.toUpperCase())).join(' ');

const isRootPactValue = (val) => {
  if (val && typeof val === 'object' ) {
    if ('timep' in val || 'int' in val || 'decimal' in val || 'time' in val ) {
      return true;
    } else {
      return false;
    }
  } else {
    return true;
  }
};

export const isPactKeyset = (val) => {
  if (val && typeof val === 'object' ) {
    if (Object.keys(val).length === 2 &&'pred' in val && 'keys' in val) {
      return true;
    } else {
      return false;
    }
  } else {
    return false;
  }
};


export const renderPactValue = (val) => {
  if (val && typeof val === 'object') {
    if ('time' in val) {
      return val['time'];
    } else if ('timep' in val) {
      return val['timep'];
    } else if ('int' in val) {
      return typeof val['int'] === 'string' ? val['int'] : val['int'].toLocaleString();
    } else if ('decimal' in val) {
      return typeof val['decimal'] === 'string' ? val['decimal'] : val['decimal'].toLocaleString();
    } else if ('pred' in val && 'keys' in val) {
      return JSON.stringify(val);
    } else {
      return JSON.stringify(val);
    }
  } else if (typeof val === 'boolean') {
    return val.toString();
  } else if (typeof val === 'string') {
    return val;
  } else if (typeof val === 'number'){
    return val.toLocaleString()
  } else {
    return JSON.stringify(val);
  }
};

const useToplevelTableStyles = makeStyles({
  table: {
    minWidth: 650,
  },
});

const useNestedTableStyles = makeStyles({
  table: {
    minWidth: 650,
  },
  root: {
    '& > *': {
      borderBottom: 'unset',
    },
  },
});

export const PactSingleJsonAsTable = (props) => {
  const json = props.json || {};
  const isNested = props.isNested || false;
  const classes = isNested ? useNestedTableStyles : useToplevelTableStyles;
  const header = props.header || [];
  const keyFormatter = props.keyFormatter ? props.keyFormatter : (k) => {return (k)};
  const valFormatter = props.valFormatter ? props.valFormatter : (str) => <code>{renderPactValue(str)}</code>;
  const internals = () =>
    <React.Fragment>
      <TableHead>
        <TableRow>
        {header.map((val) => {
          return <TableCell>{val}</TableCell>;
        })}
        </TableRow>
      </TableHead>

      <TableBody>
        {Object.entries(json).map(([k,v]) => {
          return (
          <TableRow key={k}>
            { Array.isArray(json) === false ? (
              <TableCell>{keyFormatter(k)}</TableCell>
            ) : (
              <React.Fragment></React.Fragment>
            )}
            { isRootPactValue(v) ? (
              <TableCell>{valFormatter(v)}</TableCell>
            ) : typeof v === "object" ? (
              <PactSingleJsonAsTable
                json={v}
                keyFormatter={keyFormatter}
                valFormatter={valFormatter}
                isNested={true}/>
            ) : typeof v === "function" ? (
              <TableCell>{valFormatter(v.toString())}</TableCell>
            ) : (
              <TableCell>{valFormatter(v)}</TableCell>
            )}
          </TableRow>
          )
        })}
      </TableBody>
    </React.Fragment>;

  return (
    isNested ? (
      <Table className={classes.table} size='small' aria-label="simple table">
        {internals()}
      </Table>
    ) : (
    <TableContainer component={Paper}>
      <Table className={classes.table} size='small' aria-label="simple table">
        {internals()}
      </Table>
    </TableContainer>
    )
)};

export const PactJsonListAsTable = (props) => {
  const json = props.json || {};
  const isNested = props.isNested || false;
  const classes = isNested ? useNestedTableStyles : useToplevelTableStyles;
  const header = props.header || [];
  let keyOrder = [];
  if (props.keyOrder) {
    keyOrder = props.keyOrder;
  } else if (Array.isArray(props.json)) {
    if ( json.length > 0 ) {
      keyOrder = Object.keys(json[0]);
    }
  }
  const keyFormatter = props.keyFormatter ? props.keyFormatter : (k) => {return (k)};
  const valFormatter = props.valFormatter ? props.valFormatter : (str) => <code>{renderPactValue(str)}</code>;

  const internals = () =>
    <React.Fragment>
        <TableHead>
          <TableRow>
          {header.map((val) => (
            <TableCell>{val}</TableCell>
          ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {json.map(obj => (
            <TableRow key={obj[keyOrder[0]]}>
              { keyOrder.map(k => {
                  const v = obj[k];
                  return (
                    <TableCell>
                      {isRootPactValue(v) ? (
                          valFormatter(v)
                      ) : Array.isArray(v) ? (
                          <PactJsonListAsTable
                            json={v}
                            keyFormatter={keyFormatter}
                            valFormatter={valFormatter}
                            isNested={true}/>
                      ) : typeof v === "object" ? (
                          <PactSingleJsonAsTable
                            json={v}
                            keyFormatter={keyFormatter}
                            valFormatter={valFormatter}
                            isNested={true}/>
                      ) : typeof v === "function" ? (
                          valFormatter(v.toString())
                      ) : (
                          valFormatter(v)
                      )}
                    </TableCell>
                  )
                }
            )}
            </TableRow>
          ))}
      </TableBody>
    </React.Fragment>;

  return (
    isNested ? (
      <Table className={classes.table} size='small' aria-label="simple table">
        {internals()}
      </Table>
    ) : (
    <TableContainer component={Paper}>
      <Table className={classes.table} size='small' aria-label="simple table">
        {internals()}
      </Table>
    </TableContainer>
    )
)};

const MakeInputField = (props) => {
  const {
    type,
    label,
    options,
    placeholder,
    className,
    onChange,
    value,
  } = props.inputField;

  return ( type === 'select'
    ? <TextField
        id="outlined-multiline-static"
        select
        required
        fullWidth
        className={className}
        variant="outlined"
        label={label}
        onChange={e => onChange(e.target.value)}
        >
        { Array.isArray(options) ?
            options.map(k =>
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            )
          : Object.keys(options).map(k => 
              <React.Fragment>
                <ListSubheader>{k}</ListSubheader>
                {
                  options[k].map(v => 
                    <MenuItem key={`${k}-${v}`} value={v}>
                      {v}
                    </MenuItem>
                  )
                }
              </React.Fragment>)
        }
      </TextField>
    : type === 'textFieldSingle' ?
      <TextField
        required
        fullWidth
        value={value}
        className={className}
        variant='outlined'
        label={label}
        onChange={e => onChange(e.target.value)}
      />
    : type === 'textFieldMulti' ?
      <TextField
        required
        fullWidth
        label={label}
        className={className}
        multiline
        rows={4}
        variant="outlined"
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    : type === 'checkbox' ? 
        <Checkbox
          checked={value}
          onChange={e=>onChange(e.target.value)}
          color="primary"
          label={label}
        />
    : null
  )

};

export const MakeForm = (props) => {
  const {
    inputFields,
    onSubmit,
    tx, txRes, txStatus, setTxStatus
  } = props;
  const [wasSubmitted,setWasSubmitted] = useState(false);
  useEffect(()=>setWasSubmitted(false),[inputFields]);
  useEffect(()=>txStatus !== "" ? setWasSubmitted(true) : setWasSubmitted(wasSubmitted), [txStatus])

  return (
    <div>
      <form
        autoComplete="off"
        onSubmit={e => onSubmit(e)}>
        {inputFields.map(f =>
          <MakeInputField inputField={f}/>
        )}
        <CardActions>
          {txStatus === 'pending'
            ? null
            : <Button variant="outlined" color="default" type="submit" disabled={wasSubmitted}>
                Submit
              </Button>
          }
        </CardActions>
      </form>
      { txStatus === 'pending' ? <LinearProgress /> : null }
      <PactTxStatus tx={tx} txRes={txRes} txStatus={txStatus} setTxStatus={setTxStatus}/>
    </div>
  )
};
