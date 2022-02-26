var log4js = require("log4js");
var HashMap = require('hashmap');
const Web3 = require('web3');
var fs = require('fs')
const ABI = require('./ABI.js')
const variables = require('./variables.js')
var request = require('request');

log4js.configure({
    "appenders": {
        "file": {
            "type": "file",
            "filename": "log/run.log",
            "category": "file",
            "level": "debug"
        },
        "levelFilter": {
            "type": "logLevelFilter",
            "level": "info",
            "appender": "console"
        },
        "console": {
            "type": "console"
        }
    },
    "categories": {
        "default": {"appenders": ["levelFilter", "file"], "level": "debug"},
        "keepQueryLogger": {"appenders": ["levelFilter", "file"], "level": "debug"},
    }
})
var logger = log4js.getLogger();
let keepQueryLogger = log4js.getLogger("keepQuery");

let nonce;
const web3 = new Web3(new Web3.providers.HttpProvider(variables.url));
//初始化pancake交易合约
let pancakeRouterContract = new web3.eth.Contract(ABI.pancakeRouterABI, variables.pancakeRouterContractAddress);
const web3WS = new Web3(new Web3.providers.WebsocketProvider(variables.wsurl));

//业务变量区域
//监听到的币对，可以定期存文件
let keypairWithLiquidArr = new HashMap();
let keypairWithNoLiquidArr = new HashMap();
let selling = new HashMap();
let buying = new HashMap();
//存放已经购买的token
let buyedTokens = new HashMap();
//读取配置的发送方地址
var targetAccounts = JSON.parse(fs.readFileSync('account.json', 'utf-8'));
//登录账户
let account = web3.eth.accounts.privateKeyToAccount(targetAccounts[0].privateKey);
//账户的BNB余额，每次交易成功都刷新本地缓存
let bnbBalance;
// logger.info(account)
web3.eth.accounts.wallet.add(account);
var judgeFeeParsed = [];
// console.log(web3.eth.accounts.wallet)
// web3.eth.Contract.defaultAccount.contract.defaultAccount = '0x82527E3B06bA976e7f515b2C77D65a5336B27811';
let ABIS = new HashMap();
let contractRefs = new HashMap();
let pixiuTokens = new HashMap()
let approved = [];
const sleep = function (ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}


function test() {
    /*let decodeLog = web3.eth.abi.decodeLog(ABI.keyPairCreatedABI,
        '0x0000000000000000000000004623323d3c954d048099e4dfa3d91342a6afdd9f00000000000000000000000000000000000000000000000000000000000b86ce',
        ['0x0000000000000000000000003be51f1a048daf5307e5441ee543b182939f7ede', '0x000000000000000000000000bb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c']);
    logger.info("decodeLog.token0: ", decodeLog.token0);
    logger.info("decodeLog.token1: ", decodeLog.token1);
    logger.info("decodeLog.pair: ", decodeLog.pair);*/
    let keypairInfo = {};
    keypairInfo.keypairAddress = '0xB18e3c64D619d786F2914cBFde090fF7f174C2A6'
    keypairInfo.token0 = '0x810227adb6f3A78d0D503F94CD43d649D06ecEE7';
    keypairInfo.token1 = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
    keypairInfo.token0Name = 'BINU';
    keypairInfo.token1Name = 'WBNB';
    queryKeypairLiquidityWithLatestABI(keypairInfo, ABI.keyPairContractABI).then((contractQueryResult) => {
        logger.info(contractQueryResult)
        if (contractQueryResult.token0Reserve > 0 && contractQueryResult.token1Reserve > 0) {
            keypairWithLiquidArr.set(keypairInfo.keypairAddress, Object.assign({}, contractQueryResult));

        } else {
            //1. 加入轮询队列
            keypairWithNoLiquidArr.set(contractQueryResult.keypairAddress, Object.assign({}, contractQueryResult));
            //2. 写入本地磁盘
        }
        // buyToken(contractQueryResult)
        // getNameOfToken(contractQueryResult.token0)
        // getNameOfToken(contractQueryResult.token1)
        /*getSymbolOfToken(contractQueryResult.token0).then(token0Name => {
            contractQueryResult.token0Name = token0Name;
            return getSymbolOfToken(contractQueryResult.token1);
        }).then(token1Name => {
            contractQueryResult.token1Name = token1Name;
            //buyToken(contractQueryResult)
            // cacheBuyedToken(contractQueryResult)
            keypairWithLiquidArr.set(pancakeBNBPairAddress, Object.assign({}, contractQueryResult));
        }).catch(error => {
            logger.error("error: ", error)
        });*/

    }).catch(error => {
        logger.error("error: ", error)
    });
}


/**
 * 获取当前账户拥有该合约代币数量
 * @param tokenAddress
 */
const decimals = function (tokenAddress, contract) {
    return new Promise(((resolve, reject) => {
        // getLatestABIOfToken(tokenAddress).then(abi => {
        if (!contract) {
            contract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress);
        }
        contract.methods.decimals().call(function (error, result) {
            if (error) {
                logger.error(`token decimal :`, error);
                reject(error)
            } else {
                resolve(result);
                logger.info(`token decimal: [${result}]`);
            }
        });
        // })
    }));
}
const balanceOf = function (tokenAddress, contract) {
    return new Promise(((resolve, reject) => {
        // getLatestABIOfToken(tokenAddress).then(abi => {
        if (!contract) {
            contract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress);
        }
        contract.methods.balanceOf(account.address).call(function (error, result) {
            if (error) {
                logger.error(`failed to get account [${account.address}] balance for token [${tokenAddress}]. `, error);
                reject(error)
            } else {
                resolve(result);
                logger.info(`get account [${account.address}] balance for token [${tokenAddress}]. `, result)
            }
        });
        // })
    }));
}

const getTokenReadableBalanceOf = function (tokenAddress, contract) {
    return new Promise((resolve, reject) => {
        if (!contract) {
            contract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress);
        }
        decimals(tokenAddress, contract).then(decimal => {
            balanceOf(tokenAddress, contract).then(result => {
                let numberOfBalance = Number(result) / (10 ** decimal);
                resolve(numberOfBalance)
                if (logger.isDebugEnabled()) {
                    logger.debug("get balance of succeed. ", numberOfBalance);
                }
            })
        }).catch(error => {
            logger.error(`get decimal for ${tokenAddress} failed.`, error);
            reject(error)
        })
    })
};

function getNameOfToken(tokenAddress, contract) {
    return new Promise((resolve, reject) => {
        if (!contract) {
            contract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress);
        }
        contract.methods.name().call(function (error, result) {
            if (error) {
                logger.error(`token name :`, error);
                reject(error)
            } else {
                resolve(result);
                logger.info(`token name ${tokenAddress} : [${result}]`);
            }
        });
        // })
    })
}

function getSymbolOfToken(tokenAddress, contract) {
    return new Promise((resolve, reject) => {
        if (!contract) {
            contract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress);
        }
        contract.methods.symbol().call(function (error, result) {
            if (error) {
                logger.error(`get token ${tokenAddress} symbol :`, error);
                reject(error)
            } else {
                resolve(result);
                logger.info(`token symbol ${tokenAddress} : [${result}]`);
            }
        });
        // })
    })
}

const buyToken = async function (keypairInfo) {
    buying.set(keypairInfo.token0, 1);
    //以0.025个BNB（大约10U) 购买
    let originalAmountToBuyWith = '0.05' + Math.random().toString().slice(2, 5);
    if (bnbBalance < originalAmountToBuyWith) {
        //如果账户余额不够且差额在20%以内，就以现在余额的90%去购买
        if ((originalAmountToBuyWith - bnbBalance) < (bnbBalance * 0.2)) {
            originalAmountToBuyWith = bnbBalance * 0.9;
        } else {
            //如果差的太多，直接放弃，并且取消购买
            keypairWithNoLiquidArr.delete(keypairInfo.keypairAddress);
            if (buying.has(keypairInfo.token0)) {
                logger.warn("余额不足，请您充值")
                buying.delete(keypairInfo.token0)
            }
            return;
        }
    }
    refreshNonce();
    //转精度
    let bnbAmount = web3.utils.toWei(originalAmountToBuyWith, 'ether');
    //一次性购入8位数以上的代币
    let amountOutMin = 100 + Math.random().toString().slice(2, 4);
    logger.info(`use ${originalAmountToBuyWith} BNB to swap ${amountOutMin} token [${keypairInfo.token0}]`)
    amountOutMin = web3.utils.toHex(amountOutMin);
    //需要兑换的bnb数量包含在options中
    let options = {
        from: targetAccounts[0].address,
        nonce: nonce,
        value: bnbAmount
    }
    let path = [keypairInfo.token1, keypairInfo.token0];
    let deadline = web3.utils.toHex(Math.round(Date.now()) + 60 * 10);
    //先获取gas费
    pancakeRouterContract.methods.swapExactETHForTokens(
        amountOutMin,
        path,
        targetAccounts[0].address,
        deadline)
        .estimateGas(options)
        .then(gas => {
            logger.info("current gas: ", gas)
            options.gas = gas;
            swapExactETHForTokens(options, amountOutMin, path, targetAccounts[0].address, deadline, keypairInfo)
        })
        .catch(error => {
            logger.error("get as failed. set gas to 150000", error)
            options.gas = 150000;
            swapExactETHForTokens(options, amountOutMin, path, targetAccounts[0].address, deadline, keypairInfo)
        })
}

async function sellToken(amount, keypairInfo) {
    let path = [keypairInfo.token0, keypairInfo.token1];
    logger.info("-------amount: ", amount)
    let approveMount = amount * 1.4
    approveMount = web3.utils.toWei(approveMount.toString(), 'ether');
    approveMount = web3.utils.toHex(approveMount);
    amount = amount * 0.9
    amount = web3.utils.toWei(amount.toString(), 'ether');
    let amountOutMin = "000" + amount.substring(3, amount.length)
    logger.info("-------amount toWei: ", amount)
    amount = web3.utils.toHex(amount);
    logger.info("-------amount toHex: ", amount)
    logger.info("-------amountOutMin: ", amountOutMin)
    // amountOutMin = web3.utils.toWei(amountOutMin.toString(), 'ether');
    // logger.info("-------amountOutMin toWei: ", amountOutMin)
    amountOutMin = web3.utils.toHex(amountOutMin);
    logger.info("-------amountOutMin toHex: ", amountOutMin)
    //先获取gas费

    let deadline = web3.utils.toHex(Math.round(Date.now()) + 60 * 10);
    refreshNonce(nonceStr => {
        let options = {
            nonce: nonce,
            from: targetAccounts[0].address
        }
        logger.info("amount: ", amount)
        logger.info("amountOutMin: ", amountOutMin)
        logger.info("path: ", path)

        options.gas = 210000;
        if (approved.includes(keypairInfo.token0)) {
            refreshNonce(function (nonceRefreshed) {
                options.nonce = nonceRefreshed
                swapExactTokensForTokens(options, amount, amountOutMin, path, targetAccounts[0].address, deadline, keypairInfo)
            });
        } else {
            approve(options, keypairInfo.token0, variables.pancakeRouterContractAddress, approveMount).then(resulut => {
                approved.push(keypairInfo.token0)
                logger.info("approve success. estimateGas...", resulut)
                pancakeRouterContract.methods.swapExactTokensForTokens(
                    amount,
                    amountOutMin,
                    path,
                    targetAccounts[0].address,
                    deadline)
                    .estimateGas(options)
                    .then(gas => {
                        logger.info("current gas: ", gas)
                        options.gas = gas;
                        refreshNonce(function (nonceRefreshed) {
                            options.nonce = nonceRefreshed
                            swapExactTokensForTokens(options, amount, amountOutMin, path, targetAccounts[0].address, deadline, keypairInfo)
                        });

                    }).catch(error => {oøƒƒ
                    logger.error("estimateGas error", error)
                    selling.delete(keypairInfo.token0);
                })
            }).catch(error => {
                logger.error(`approve ${keypairInfo.token} error`, error)
                selling.delete(keypairInfo.token0);
            });
        }
    });

}

/**
 * 授权给交易所对指定token的提取权限
 * @param tokenAddress
 * @param dexContractAddress
 * @param amountIn
 * @param tokenContract
 */
function approve(options, tokenAddress, dexContractAddress, amountIn, tokenContract) {
    return new Promise((resolve, reject) => {
        if (!tokenContract) {
            tokenContract = new web3.eth.Contract(ABI.ERC20ABI, tokenAddress)
        }
        tokenContract.methods.approve(dexContractAddress, amountIn).send(options, function (error, result) {
            logger.info(`token [${tokenAddress}] approve contract [${tokenAddress}] for amounut ${web3.utils.fromWei(amountIn)} : [${result}]`);
            if (error) {
                logger.error(error);
                reject(error)
            }
        }).on("receipt", function (receipt) {
            if (logger.isDebugEnabled()) {
                logger.debug("approve receipt: ", receipt);
            }
            if (receipt["status"] === true) {
                resolve(true)
            }
        })
    });
}

/**
 * 以指定的BNB数量兑换尽可能多的另外一种token
 * @param options
 * @param amountIn
 * @param amountMin
 * @param path
 * @param to
 * @param deadline
 * @returns {Promise<void>}
 */
async function swapExactTokensForETH(options, amountIn, amountOutMin, path, to, deadline, keypairInfo) {
    //以指定的BNB数量兑换尽可能多的另外一种token
    pancakeRouterContract.methods.swapExactTokensForETH(
        amountIn,
        amountOutMin,
        path,
        to,
        deadline)
        .send(options, function (error, result) {
            if (error) {
                logger.error("swapExactTokensForETH failed. ", error);
            } else {
                logger.info(`swap [${web3.utils.fromWei(amountIn)}] ${keypairInfo.token0Name} to ${keypairInfo.token1Name} successfully.`)
            }
        }).on('transactionHash', function (hash) {
        logger.info("transactionHash: ", hash)
    }).on('receipt', function (receipt) {
        // receipt example
        logger.info("receipt: ", receipt);
        if (receipt["status"] != false) {
            uncacheToken(keypairInfo);
        }
    }).on('error', function (error) {
        selling.set(keypairInfo.token0, 0);
        logger.error("error: ", error)
    });
}

async function swapExactTokensForTokens(options, amountIn, amountOutMin, path, to, deadline, keypairInfo) {
    //以指定的BNB数量兑换尽可能多的另外一种token
    pancakeRouterContract.methods.swapExactTokensForTokens(
        amountIn,
        amountOutMin,
        path,
        to,
        deadline)
        .send(options, function (error, result) {
            if (!error) {
                logger.info(`swap [${web3.utils.fromWei(amountIn)}] ${keypairInfo.token0Name} to ${keypairInfo.token1Name} successfully.`, result)
            }
        }).on('transactionHash', function (hash) {
        logger.info("swapExactTokensForTokens transactionHash: ", hash)
    }).on('receipt', function (receipt) {
        // receipt example
        logger.debug("receipt: ", receipt);
        if (receipt["status"] != false) {
            logger.info("swapExactTokensForTokens succeed. goto uncacheToken()")
            uncacheToken(keypairInfo);
        }
    }).on('error', function (error) {
        selling.delete(keypairInfo);
        logger.error(`swapExactTokensForTokens ${keypairInfo.token0Name}/${keypairInfo.token1Name} failed. token0 address [${keypairInfo.token0}]: `, error)
    });
}

/**
 * 以指定的BNB数量兑换尽可能多的另外一种token
 * @param options
 * @param amountOutMin
 * @param path
 * @param to
 * @param deadline
 * @param keypairInfo
 * @returns {Promise<void>}
 */
async function swapExactETHForTokens(options, amountOutMin, path, to, deadline, keypairInfo) {
    //以指定的BNB数量兑换尽可能多的另外一种token
    pancakeRouterContract.methods.swapExactETHForTokens(
        amountOutMin,
        path,
        to,
        deadline)
        .send(options, function (error, result) {
            if (error) {
                buying.set(keypairInfo.token0, 0);
                logger.error("swapExactETHForTokens failed. ", error);
            } else {
                logger.info(`swapExactETHForTokens [${keypairInfo.token0Name}/${keypairInfo.token1Name}] [${keypairInfo.token0}]  sent `, result)
            }

        }).on('transactionHash', function (hash) {
        logger.info("swapExactETHForTokens transactionHash: ", hash)
    }).on('receipt', function (receipt) {
        // receipt example
        if (logger.isDebugEnabled()) {
            logger.debug(`swapExactETHForTokens [${keypairInfo.token0Name}/${keypairInfo.token1Name}] [${keypairInfo.token0}]  receipt: `, receipt)
        }
        if (receipt["status"] === true) {
            logger.info(`swapExactETHForTokens [${keypairInfo.token0Name}/${keypairInfo.token1Name}] [${keypairInfo.token0}] succeed. goto cacheBuyedToken.`)
            cacheBuyedToken(keypairInfo, options.value);
        }
    }).on('error', function (error) {
        buying.set(keypairInfo.token0, 0);
        logger.error(`swapExactETHForTokens [${keypairInfo.token0Name}/${keypairInfo.token1Name}] [${keypairInfo.token0}]  failed. `, error);
    });
}

function uncacheToken(keypairInfo) {
    selling.delete(keypairInfo.token0);
    buyedTokens.delete(keypairInfo.token0)
    keypairWithLiquidArr.delete(keypairInfo.token0)

}

function cacheBuyedToken(keypairInfo, amountHex) {
    //刷新本地BNB余额
    refreshLocalBNBBalance()
    logger.info(`buy token [${keypairInfo.token0Name}/${keypairInfo.token1Name}] [${keypairInfo.keypairAddress}] success. cache to local array.`)
    //成功购买，在无流动性币对的缓存中移除
    keypairWithNoLiquidArr.delete(keypairInfo.keypairAddress);
    //移除buying标志
    buying.delete(keypairInfo.token0);
    contractRefs.delete(keypairInfo.keypairAddress)
    if (!buyedTokens.has(keypairInfo.token0)) {
        let obj = Object.assign({}, keypairInfo);
        obj.time = Date.now();
        if (amountHex) {
            obj.bnbSent = web3.utils.hexToNumber(amountHex);
        }
        buyedTokens.set(keypairInfo.token0, obj);
    }

}

let times = 1;
let interval = 6;
//初始睡眠10S
let initSleepTime = 10 * 1000;
let sleepSeed = 1;
//轮询币对是否有流动性
const keepQuery = async function () {
    while (1) {
        keepQueryLogger.info("开始遍历所有无流动性币对...")
        keepQueryLogger.info("now cached no liquid token num: ", keypairWithNoLiquidArr.size);
        keepQueryLogger.info("now cached have liquid token num: ", keypairWithLiquidArr.size);
        if (times % 50 == 0) {//二十分钟打印一次详细信息
            keepQueryLogger.info("cached no liquidity pairs: ", keypairWithNoLiquidArr.values());
            keepQueryLogger.info("cached has liquidity pairs: ", keypairWithLiquidArr.values());
            times = 1;
        }
        if (keypairWithNoLiquidArr.size == 0) {
            await sleep(3000);
            continue;
        }

        let promises = [];
        let entries = keypairWithNoLiquidArr.entries();
        for (let i=0;i<entries.length;i++){
            let entry = entries[i];
            let keypairAddress = entry[0];
            let keypairInfo = entry[1]
            //30S打印一次
            if (times % 3 === 0) {
                keepQueryLogger.info(`query liquidity for [${keypairInfo.token0Name}/${keypairInfo.token1Name}]`);
            }
            promises.push(queryKeypairLiquidityWithLatestABI(keypairInfo, ABI.keyPairContractABI))
            if ((i + 1) % interval == 0 || i == (entries.length - 1)) {
                await Promise.all(promises).then(contractQueryResults => {
                    try {
                        logger.info("contractQueryResults: ", contractQueryResults)
                        contractQueryResults.forEach(contractQueryResult => {
                            promises = [];
                            if (contractQueryResult.token0Reserve > 0 && contractQueryResult.token1Reserve > 0) {
                                if (buying.has(contractQueryResult.token0) && buying.get(contractQueryResult.token0) === 1) {
                                    if (times % 10 == 0) {
                                        keepQueryLogger.info(`token ${contractQueryResult.token0Name}/${contractQueryResult.token1Name} is buying... `);
                                    }
                                    return;
                                }
                                if (buyedTokens.has(contractQueryResult.token0)) {
                                    if (times % 10 == 0) {
                                        keepQueryLogger.info(`token [${contractQueryResult.token0Name}] already buy.`);
                                    }
                                    return;
                                }
                                isPiXiu(contractQueryResult.token0).then(pixiu => {
                                    logger.info(`${contractQueryResult.token0Name} is pixiu : ${pixiu}`)
                                    if (pixiu === "empty") {
                                        if (pixiuTokens.has(contractQueryResult.token0)) {
                                            let firstEmptyTime = pixiuTokens.get(contractQueryResult.token0)
                                            let now = Date.now();
                                            //如果距离返回empty的时间超过160秒（大约2分半），
                                            if ((now - firstEmptyTime) > (1000 * 160)) {
                                                pixiuTokens.delete(contractQueryResult.token0)
                                                keepQueryLogger.info(`${contractQueryResult.token0Name} cannot get result from gopluslabs over 3mins.`)
                                                keypairWithNoLiquidArr.delete(contractQueryResult.keypairAddress);
                                                contractRefs.delete(contractQueryResult.keypairAddress)
                                            }
                                        } else {
                                            pixiuTokens.set(contractQueryResult.token0, Date.now())
                                        }
                                    } else if (pixiu === "yes") {
                                        keepQueryLogger.warn(`${contractQueryResult.token0Name} 是貔貅，日他妈的。`);
                                        keypairWithNoLiquidArr.delete(contractQueryResult.keypairAddress);
                                        keepQueryLogger.info("rest keypair keys: ", keypairWithNoLiquidArr.keys())
                                        keepQueryLogger.info("now keypair keys in cycle: ", keys)

                                        contractRefs.delete(contractQueryResult.keypairAddress)
                                    } else {
                                        keepQueryLogger.info(`keypair [${contractQueryResult.token0Name}/${contractQueryResult.token1Name}] ${contractQueryResult.keypairAddress}  has liquid. go to swap `);
                                        keepQueryLogger.info(`${contractQueryResult.token0Name} reverse: ${contractQueryResult.token0Reserve}, ${contractQueryResult.token1Name} reverse: ${contractQueryResult.token1Reserve}`);
                                        pixiuTokens.delete(contractQueryResult.token0)
                                        //FixMe 用于测试一晚能订阅多少币对，暂时不做真实购买
                                        buyToken(contractQueryResult);
                                        //FixME 用于测试一晚能订阅对少币对，有流动性之后就直接加入缓存，不做真实购买，正式运行需要注释
                                        // keypairWithLiquidArr.set(keypairInfo.keypairAddress, keypairInfo);
                                        // keypairWithNoLiquidArr.delete(keypairInfo.keypairAddress);
                                    }
                                })

                            } else {
                                //还是没有余额，继续轮询
                                //do nothing
                            }
                        })
                    } catch (e) {
                        logger.error("error in promise.all() ",e)
                    }
                }).catch(error => {
                    keepQueryLogger.error(`get batch liquidity failed. ignore...`, error)
                });
                promises = [];
                keepQueryLogger.info("continue query.....")
            }
        }
        times++;
        // let sleepTime = parseInt(initSleepTime / (sleepSeed + (parseInt(keypairWithNoLiquidArr.size / 10))))
        logger.info(`now go to sleep 5000ms`)
        await sleep(3000);
    }
}


const tryToSell = async () => {
    logger.info("starting tryToSell batchJob...")
    let turns = 1;
    while (1) {
        if (turns % 5 === 0) {
            logger.info("now buyed tokens: ", buyedTokens.size);
        }
        if (turns === 30 * 10) {
            logger.info("buyed tokens: ", buyedTokens.values())
            turns = 1;
        }
        let cachedTokenPairInfo = buyedTokens.values();
        for (let i = 0; i < cachedTokenPairInfo.length; i++) {
            let keypairInfo = cachedTokenPairInfo[i];
            let now = Date.now();
            //购买时间超过10分钟就卖出
            if ((now - keypairInfo.time) >= 1000 * 60 * 3) {
                if (selling.has(keypairInfo.token0) && selling.get(keypairInfo.token0) === 1) {
                    if (turns % 5 === 0) {
                        logger.info(`token [${keypairInfo.token0Name}] is selling...`)
                    }
                    break;
                }
                selling.set(keypairInfo.token0, 1);
                logger.info(`token [${keypairInfo.token0Name}] holded over 5min. it's time to sell.`);
                //1. 获取余额
                getTokenReadableBalanceOf(keypairInfo.token0).then(balance => {
                    if (balance > 0) {
                        logger.info(`have ${balance} [${keypairInfo.token0Name}] , all will be swap.`);
                        //2. 调用方法以确定的代币换取尽可能多的BNB
                        sellToken(balance, keypairInfo).catch(error => {
                            logger.info(`sell token ${keypairInfo.token0Name}/${keypairInfo.token1Name} ${keypairInfo.token0} failed.`, error)
                        });
                    }
                }).catch(error => {
                    selling.delete(keypairInfo.token0);
                })

            }
        }
        turns++;
        await sleep(2000);
    }
}
const handleKeypairCreateLog = function (data, topics) {
    let decodeLog = web3.eth.abi.decodeLog(ABI.keyPairCreatedABI, data,
        [topics[1], topics[2]]);
    let keypairLeft = decodeLog.token0;
    let keypairLeftName;
    let keypairRightName;
    let keypairRight = decodeLog.token1;
    let keypairAddress = decodeLog.pair;
    if (decodeLog.token1 != variables.wbnbContractAddress && decodeLog.token0 != variables.wbnbContractAddress) {
        let leftNameOfToken = getNameOfToken(keypairLeft);
        let rightNameOfToken = getNameOfToken(keypairRight);
        Promise.all([leftNameOfToken, rightNameOfToken]).then(names => {
            logger.warn(`created keypair [${names[0]}/${names[1]}] is not ?/WBNB. ignored`)

        })
        return;
    } else {
        if (decodeLog.token0 === variables.wbnbContractAddress) {
            keypairLeft = decodeLog.token1;
            keypairRight = decodeLog.token0;
        }
        Promise.all([getSymbolOfToken(keypairLeft), getSymbolOfToken(keypairRight)]).then(names => {
            keypairLeftName = names[0];
            keypairRightName = names[1];
            logger.info("keypairLeft: ", keypairLeftName);
            logger.info("keypairRight: ", keypairRightName);
            logger.info("keypairAddress: ", keypairAddress);
            isPiXiu(keypairLeft).then(pixiu => {
                if (pixiu == "no") {
                    logger.info(`new keyPair [${keypairLeftName}/${keypairRightName}]  holders over 30. gogogo!!`)
                    queryKeypairLiquidityWithLatestABI(keypairAddress, ABI.keyPairContractABI).then((contractQueryResult) => {
                        contractQueryResult.token0 = keypairLeft;
                        contractQueryResult.token1 = keypairRight;
                        contractQueryResult.token0Name = keypairLeftName;
                        contractQueryResult.token1Name = keypairRightName;
                        if (contractQueryResult.token0Reserve > 0 && contractQueryResult.token1Reserve > 0) {
                            logger.info(`${keypairLeftName} reverse: ${contractQueryResult.token0Reserve} ,${keypairRightName} reverse: ${contractQueryResult.token1Reserve}`)
                            logger.info(`[${keypairLeftName}/${keypairRightName}] 持币人数大于30且有流动性，去下单喽...`)
                            keypairWithLiquidArr.set(contractQueryResult.keypairAddress, contractQueryResult);
                            buyToken(contractQueryResult)
                        }
                    });
                } else {
                    var contractQueryResult = {};
                    contractQueryResult.token0 = keypairLeft;
                    contractQueryResult.token1 = keypairRight;
                    contractQueryResult.token0Name = keypairLeftName;
                    contractQueryResult.token1Name = keypairRightName;
                    contractQueryResult.keypairAddress = keypairAddress;
                    //1. 加入轮询队列
                    keypairWithNoLiquidArr.set(contractQueryResult.keypairAddress, contractQueryResult);
                }
            })
        }).catch(error => {
            logger.error(`get token [${keypairLeft} symbol failed. `, error)
        });
    }
}
/**
 *  一般发生在添加流动性后挖矿流动性凭证LP
 *  所以这时候判断前面是否有保存新添加的币对，如果有的话证明已添加流动性，可以进行交易
 *  开启mint的地址应该是keypair合约地址
 * @param address
 */
const handleMintLog = function (address) {
    //遍历未添加流动性keypair数组看是否有保存
    //没有的话不知道是不是添加流动性挖矿，留到后面分析
    if (keypairWithNoLiquidArr.has(address)) {
        logger.warn(`Good news! Keypair ${address} has added liquid! go to swap now!`)
        //TODO 推送钉钉、电报
        buyToken(matchedKeypair);
    }
}
const handleLog = function (result) {
    let transactionHash = result["transactionHash"];
    let blockNum = result["blockNumber"];
    let topics = result["topics"];
    let data = result["data"];
    let address = result["address"];
    let functionNameHash = topics[0];
    logger.info("receive log --- topics[0]:  ", functionNameHash)
    //keyPairCreated日志
    if (functionNameHash === variables.keyPairCreatedEventSHA) {
        logger.info("receive keypairCreated log ")
        handleKeypairCreateLog(data, topics);
    }
    //mint 日志
    else if (functionNameHash === variables.mintTopicSHA) {
        logger.info("receive mint log, ", result)
        handleMintLog(address);
    }
    else {
        if (logger.isDebugEnabled()) {
            logger.debug("received log is unexpected. ", result);
        }
    }

}

/**
 * 从bsc查询最新的ABI
 * @param tokenAddress
 * @returns {Promise<any>}
 */
function getLatestABIOfToken(tokenAddress, defaultABI) {
    return new Promise((resolve, reject) => {
        request('https://api.bscscan.com/api?module=contract&action=getabi&address=' + tokenAddress + '&apikey=' + variables.bscScanAPIKey, function (err, response, body) {
            if (!err && response.statusCode == 200) {
                //todoJSON.parse(body)
                let parse = JSON.parse(body);
                let abi = parse.result;
                try {
                    resolve(JSON.parse(abi));
                } catch (e) {
                    logger.error("failed to get contract ABI, set default. ABI response: ", body)
                    if (parse.status == "0" && parse.result.indexOf("source code not verified") != -1) {
                        logger.info("contract source code not verified. use the default.")
                        resolve(defaultABI);
                    } else {
                        resolve(defaultABI);
                    }
                }
            }
        });
    })
}

async function queryKeypairLiquidityWithLatestABI(keypairInfo, defaultABI) {
    //初始化pair合约对象
    //1. 获取pair合约的abi
    if (ABIS.has(keypairInfo.keypairAddress)) {
        return queryKeypairLiquidity(keypairInfo, ABIS.get(keypairInfo.keypairAddress));
    } else {
        let result;
        await getLatestABIOfToken(keypairInfo.keypairAddress, defaultABI).then(abi => {
            ABIS.set(keypairInfo.keypairAddress, abi)
            result = queryKeypairLiquidity(keypairInfo, abi)

        }).catch(error => {
            logger.warn(`get latest ABI of keypair [${keypairInfo.keypairAddress}] . ignore this keypair.`)
            keypairWithNoLiquidArr.delete(keypairInfo.keypairAddress)
            //reject(error)
        })
        return result;
    }
}

const  queryKeypairLiquidity = async (keypairInfo, abi) => {
    if (ABIS.has(keypairInfo.keypairAddress)) {
        abi = ABIS.get(keypairInfo.keypairAddress);
    }
    let copied = Object.assign({},keypairInfo);
    //初始化pair合约对象
    return new Promise((resolve, reject) => {
        let contract;
        try {
            if (contractRefs.has(copied.keypairAddress)) {
                contract = contractRefs.get(copied.keypairAddress);
            } else {
                contract = new web3.eth.Contract(abi, copied.keypairAddress);
                contractRefs.set(contract)
            }
            contract.methods.getReserves().call(function (error, result) {
                if (error) {
                    logger.error("get pair reverse failed. ", error);
                    copied.token0Reserve = 0;
                    copied.token1Reserve = 0;
                    resolve(copied)

                } else {
                    copied.token0Reserve = result._reserve0;
                    copied.token1Reserve = result._reserve1;
                    resolve(copied)

                }
            })
        } catch (e) {
            copied.token0Reserve = 0;
            copied.token1Reserve = 0;
            logger.error("trycatch erorr. ",e)
            resolve(copied)

        }
    })
}

/**
 * 获取账户的BNB余额并刷新本地缓存
 */
function refreshLocalBNBBalance() {
    //币安的精度默认是10^18
    web3.eth.getBalance(targetAccounts[0].address).then(result => {
        bnbBalance = result / (10 ** 18);
        logger.info("refresh local balance success. balance of bnb now:", bnbBalance)
    });
}

function refreshNonce(callback) {
    web3.eth.getTransactionCount(targetAccounts[0].address).then(result => {
        nonce = '0x' + (result + 1).toString(16)
        logger.info("nonce: ", nonce)
        if (callback) {
            logger.info("aaaa")
            callback(nonce);
        }
    })
}

function keepSubscription() {
    var subscription = web3WS.eth.subscribe('logs', {
        address: '0xca143ce32fe78f1f7019d7d551a6402fc5350c73',
        topics: null
    }, function (error, result) {
        if (!error && error != null) {
            logger.error("subscription error. ", error);
        } else {
            logger.info("-------------received log:--------------")
            logger.info(result)
        }

    }).on("connected", function (subscriptionId) {
        logger.info("subscription connected. ", subscriptionId);
    }).on("data", function (log) {
        handleLog(log);
    }).on("changed", function (log) {
        logger.info("log changed. ", log)
    });
}

function isPiXiu(tokenAddress) {
    tokenAddress = tokenAddress.toLocaleLowerCase()
    return new Promise((resolve, reject) => {
        request('https://api.gopluslabs.io/api/v1/token_security/56?contract_addresses=' + tokenAddress, function (err, response, body) {
            if (!err && response.statusCode == 200) {
                //todoJSON.parse(body)
                let parsedBody = JSON.parse(body);
                let {code, result} = parsedBody;
                logger.info(`gopluslabs body, `, result)
                // logger.info(Object.keys(result))
                // logger.info(tokenAddress)
                if (code === 1 && parsedBody['result'] && Object.keys(result).length > 0) {
                    result = result[tokenAddress]
                    try {
                        /*if (!result['is_open_source']) {
                            return resolve('empty');
                        }
                        let isOpenSource = result['is_open_source'];
                        if (isOpenSource && isOpenSource == 0) {
                            logger.info(`token ${tokenAddress} is not opensource.`)
                            return resolve("yes");
                        }
                        let isHoneypot = result['is_honeypot'];
                        logger.info("isHoneypot  ",isHoneypot)
                        if (isHoneypot && isHoneypot == 1) {
                            logger.info(`token ${tokenAddress} is honeypot.`)
                            return resolve("yes");
                        }
                        let sellTax = result['sell_tax'];
                        logger.info("sellTax  ",sellTax)
                        if (sellTax && sellTax > 0.4) {
                            logger.info(`token ${tokenAddress} setTax>0.4.`)
                            return resolve("yes");
                        }*/
                        let judgeFeeResult = judgeFee(result, tokenAddress);
                        let judgeHolderResult = judgeHolder(result, tokenAddress);
                        if (judgeFeeResult == "no" && judgeHolderResult == "no") {
                            logger.info(`token ${tokenAddress} is not pixiu. 感恩`);
                            return resolve("no");
                        }
                        //暂时以holder为准，fee仅记录做参考
                        return resolve(judgeHolderResult)
                    } catch (e) {
                        logger.error("detect token failed. ", e)
                        return resolve("yes");
                    }
                } else {
                    return resolve("empty");
                }
            } else {
                return resolve("yes")
            }
        });
    })
}

function judgeFee(result, tokenAddress) {
    if (!result['is_open_source']) {
        return 'empty';
    }
    let isOpenSource = result['is_open_source'];
    if (isOpenSource && isOpenSource == 0) {
        logger.info(`token ${tokenAddress} is not opensource.`)
        return "yes";
    }
    let isHoneypot = result['is_honeypot'];
    logger.info("isHoneypot  ", isHoneypot)
    if (isHoneypot && isHoneypot == 1) {
        logger.info(`token ${tokenAddress} is honeypot.`)
        return "yes";
    }
    let sellTax = result['sell_tax'];
    let buyTax = result['buy_tax']
    logger.info("sellTax  ", sellTax)
    if (sellTax && buyTax && 0 < sellTax < 0.1 && 0 < buyTax < 0.1) {
        logger.info(`token ${tokenAddress} setTax>0.4.`);
        if (!judgeFeeParsed.includes(tokenAddress)) {
            judgeFeeParsed.push(tokenAddress);
        }
        logger.info("judgeFeeParsed, ", judgeFeeParsed)
        return "no";
    }

}

function judgeHolder(result, tokenAddress) {
    let holderCount = result['holder_count']
    if (holderCount >= 20 && holderCount < 30) {
        logger.info(`token ${tokenAddress} holderCount between 20-30`);
    }
    if (!holderCount || holderCount < 30) {
        logger.info(`token ${tokenAddress} holderCount<30 .`);
        return "empty";
    } else {
        logger.info(`token ${tokenAddress} holderCount >= 30`);
        return "no"
    }
}

async function batchJob(str) {
    return new Promise((resolve, reject) => {
        if (str == "job3" || str == "job6") {
            reject(`failed to handle ${str}`)
        }
        console.log("this is the real job, ", str);
        resolve(`i've done the job [${str}]`)
    })
}

async function testKeep() {
    let arr = [];
    for (let i = 1; i <= 32; i++) {
        arr.push("job" + i)
    }
    let promises = [];
    while(1){
        for (let i = 0; i < arr.length; i++) {
            promises.push(batchJob(arr[i]))
            if ((i + 1) % interval == 0 || i == (arr.length - 1)) {
                await Promise.all(promises).then(jobResults => {
                    jobResults.forEach(jobResult => {
                        logger.info("jobResult in the main circulate: ", jobResult)
                    })
                }).catch(error => {
                    logger.info("error with batch job ", error)
                })
                promises = [];
            }
        }
        logger.info("sleep 2000ms")
        await sleep(2000);
    }

}


// testKeep();
// testBuy()
// logger.info(web3.utils.fromWei("4833000000000000000"))
// logger.info(web3.utils.fromWei("2495213340181622"))
// logger.debug("this is debug message for file.")
// test()
// isPiXiu('0xf42555A03164b327D94aF40446355253B1a0E7B1').then(pixiu => {
//     logger.info(pixiu)
// })

// test()
// testKeep()
// mapTest()
keepSubscription()
keepQuery()
tryToSell();
// Process jobs from as many servers or processes as you like
