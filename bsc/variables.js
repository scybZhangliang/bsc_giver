//ankr代理地址
const url = 'https://xml_zl:123456@apis.ankr.com/3529422ebbb94902a81bb7e5463f00b2/cd0731afdcc8ee1640e7b5a2e0a0a91e/binance/full/main'  // url string
const wsurl = 'wss://xml_zl:123456@apis.ankr.com/wss/3529422ebbb94902a81bb7e5463f00b2/cd0731afdcc8ee1640e7b5a2e0a0a91e/binance/full/main';

//币对创建log的topic  hash
const keyPairCreatedEventSHA = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9';
//币对创建后添加流动性后mint LP凭证的topic hash
const mintTopicSHA = '0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f';
const pancakeFactorContractAddress = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
//pancake交易所合约地址
const pancakeRouterContractAddress = "0x10ed43c718714eb63d5aa57b78b54704e256024e";
//币安区块浏览器的api key，用来动态获取abi等
const bscScanAPIKey = "DBGJI4AKRBHDKJBFI3MYE6N26E8IUKPY8D";
const wbnbContractAddress = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
//需要订阅的日志中包含的方法名
//keypairCreated: 0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9
//mint: 0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f
const subscribeTopics = ['0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9','0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4f'];

module.exports = {
    url,
    wsurl,
    keyPairCreatedEventSHA,
    pancakeFactorContractAddress,
    pancakeRouterContractAddress,
    bscScanAPIKey,
    mintTopicSHA,
    subscribeTopics,
    wbnbContractAddress
}
