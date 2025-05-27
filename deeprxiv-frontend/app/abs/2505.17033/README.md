# Boosting Binomial Exotic Option Pricing with Tensor Networks

## arXiv ID
2505.17033

## Authors
Maarten van Damme, Rishi Sreedhar, Martin Ganahl

## Abstract
Pricing of exotic financial derivatives, such as Asian and multi-asset American basket options, poses significant challenges for standard numerical methods such as binomial trees or Monte Carlo methods. While the former often scales exponentially with the parameters of interest, the latter often requires expensive simulations to obtain sufficient statistical convergence. This work combines the binomial pricing method for options with tensor network techniques, specifically Matrix Product States (MPS), to overcome these challenges. Our proposed methods scale linearly with the parameters of interest and significantly reduce the computational complexity of pricing exotics compared to conventional methods. For Asian options, we present two methods: a tensor train cross approximation-based method for pricing, and a variational pricing method using MPS, which provides a stringent lower bound on option prices. For multi-asset American basket options, we combine the decoupled trees technique with the tensor train cross approximation to efficiently handle baskets of up to m= 8 correlated assets. All approaches scale linearly in the number of discretization steps N for Asian options, and the number of assets m for multi-asset options. Our numerical experiments underscore the high potential of tensor network methods as highly efficient simulation and optimization tools for financial engineering.

## Links
- [View on arXiv](https://arxiv.org/abs/2505.17033)
- [Download PDF](https://arxiv.org/pdf/2505.17033.pdf)

## Extracted Text
Boosting Binomial Exotic Option Pricing with Tensor Networks
Maarten van Damme,1Rishi Sreedhar,1and Martin Ganahl1,∗
1SandboxAQ, Palo Alto, CA, USA
(Dated: May 26, 2025)
Pricing of exotic financial derivatives, such as Asian and multi-asset American basket options,
poses significant challenges for standard numerical methods such as binomial trees or Monte Carlo
methods. While the former often scales exponentially with the parameters of interest, the latter
often requires expensive simulations to obtain sufficient statistical convergence. This work com-
bines the binomial pricing method for options with tensor network techniques, specifically Matrix
Product States (MPS), to overcome these challenges. Our proposed methods scale linearly with
the parameters of interest and significantly reduce the computational complexity of pricing exotics
compared to conventional methods. For Asian options, we present two methods: a tensor train
cross approximation-based method for pricing, and a variat...
