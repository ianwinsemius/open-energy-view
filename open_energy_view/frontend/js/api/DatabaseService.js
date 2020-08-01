import axios from "axios";
import React from "react";
import {
  attemptP,
  fork,
  and,
  value,
  chain,
  parallel,
  reject,
  encase,
} from "fluture";
import cookie from "react-cookies";
import AuthService from "./AuthService";
import { map, compose, mean } from "ramda";
import EnergyDisplay from "../components/History/EnergyDisplay";
import { EnergyHistory } from "../data-structures/EnergyHistory";
import SourceRegistration from "../components/SourceRegistration";
import { fromJS as toImmutableJSfromJS } from "immutable";
import { List } from "immutable";
import { calculatePassiveUse } from "../data-structures/helpers/calculatePassiveUse";
import { zipPassiveCalculation } from "../data-structures/helpers/zipPassiveCalculation";
import { extract } from "../functions/extract";
import Either from "ramda-fantasy/src/Either";
import { defaultPartitions } from "../data-structures/helpers/defaultPartitions";
import { meanOf } from "../functions/meanOf";
import { tabulatePartitionSums } from "../functions/tabulatePartitionSums";
import { calculateSpikeUse } from "../data-structures/helpers/calculateSpikeUse";

export const getSourcesF = () => {
  return attemptP(() => {
    return axios.post("/api/web/sources", {}, AuthService.getAuthHeader());
  });
};

export const addPgeSource = (regInfo) => {
  return axios.post("/api/web/add/pge-demo", regInfo, AuthService.getAuthHeader());
};

export const getPartitionOptions = (source) => {
  return axios.post(
    "/api/web/partition-options",
    { source: source },
    AuthService.getAuthHeader()
  );
};

export const parseHourResponse = (partitions) => (res) => {
  const parseDatabaseResponse = compose(
    toImmutableJSfromJS,
    map(formatPGEHourDB),
    (x) => x.split(",")
  );
  //TODO: combine zipPassiveCalculation and the spike calculation

  const responseString = res.data.useLocalStorage
    ? getLocalStorage(res.data.email, res.data.friendlyName)
    : updateLocalStorage(
        res.data.email,
        res.data.friendlyName,
        res.data.database,
        res.data.lastUpdate
      );

  const energyHistoryString = sliceEnergyHistoryStringFromResponse(
    responseString
  );
  const data = parseDatabaseResponse(energyHistoryString);
  const passiveUse = calculatePassiveUse(data);
  const zippedPassive = zipPassiveCalculation(data, passiveUse.value);

  let partitionOptions = res.data.partitionOptions
    ? Either.Right(res.data.partitionOptions)
    : Either.Right(defaultPartitions);

  if (partitions) {
    partitionOptions = Either.Right(partitions);
  }

  const spikes = calculateSpikeUse(zippedPassive);

  const zipped = [];
  for (let i = 0; i < zippedPassive.size; i++) {
    const hour = zippedPassive.get(i);
    const active = hour.get("active") - spikes[i];
    const zip = hour.withMutations((hour) => {
      hour.set("active", active).set("spike", spikes[i]);
    });
    zipped.push(zip);
  }
  const zippedList = List(zipped);

  return {
    utility: res.data.utility,
    interval: res.data.interval,
    friendlyName: res.data.friendlyName,
    lastUpdate: res.data.lastUpdate,
    email: res.data.email,
    hourlyMean: meanOf(extract("total")(data)),
    partitionOptions: partitionOptions,
    partitionSums: tabulatePartitionSums(zippedList, partitionOptions),
    database: zippedList,
  };
};

const formatPGEHourDB = (data) => {
  const secondsInHour = 3600;
  const msInSeconds = 1000;
  //TODO - validate input and fork

  return {
    x: data.slice(0, 6) * secondsInHour * msInSeconds,
    total: parseInt(data.slice(6)),
  };
};

const makeSources = (energyHistoryInstance) => {
  return {
    title: energyHistoryInstance.friendlyName,
    component: <EnergyDisplay energyHistoryInstance={energyHistoryInstance} />,
  };
};

const sourcesF = getSourcesF().pipe(map((x) => x.data));

export const theFuture = (partitions) => {
  return sourcesF
    .pipe(map((x) => x.map(getHourlyData)))
    .pipe(chain(parallel(10)))
    .pipe(map(map(parseHourResponse(partitions))))
    .pipe(map(map((x) => new EnergyHistory(x))))
    .pipe(map(map(makeSources)));
};

const getLocalStorage = (email, source) => {
  return localStorage.getItem(`${email}${source}`);
};

const updateLocalStorage = (email, source, energyHistoryString, lastUpdate) => {
  const keyString = `${email}${source}`;
  for (let i = 0; i < localStorage.length; i++) {
    if (localStorage.key(i).slice(0, keyString.length) === keyString) {
      localStorage.removeItem(localStorage.key(i));
    }
  }

  const lastUpdatePadded = JSON.stringify(lastUpdate).padStart(13, "0");
  const prefixedEnergyHistoryString = `${lastUpdatePadded}${energyHistoryString}`;

  localStorage.setItem(`${email}${source}`, prefixedEnergyHistoryString);
  return prefixedEnergyHistoryString;
};

const sliceEnergyHistoryString = (updateOrData) => (response) => {
  const LENGTH_OF_MS_TIMESTAMP = 13;
  if (updateOrData === "update")
    return response.slice(0, LENGTH_OF_MS_TIMESTAMP);
  if (updateOrData === "data") return response.slice(LENGTH_OF_MS_TIMESTAMP);
};
const sliceLastUpdateFromResponse = sliceEnergyHistoryString("update");
const sliceEnergyHistoryStringFromResponse = sliceEnergyHistoryString("data");

export const getHourlyData = (source) => {
  const email = cookie.load("logged_in");
  const localStorageString = getLocalStorage(email, source);
  const lastUpdate = localStorageString
    ? sliceLastUpdateFromResponse(localStorageString)
    : null;

  return attemptP(() =>
    axios.post(
      "/api/web/data/hours",
      { source, lastUpdate },
      AuthService.getAuthHeader()
    )
  );
};
